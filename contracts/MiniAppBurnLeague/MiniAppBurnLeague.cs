using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniAppBurnLeague — self-contained on-chain competitive burn league (NO oracle / OS kernel).
    ///
    /// WHY: the app previously routed burns through the OS GameProxy/LeaderboardProxy
    /// edge functions (which moved nothing once the kernel degraded) and read a pool /
    /// leaderboard that no contract maintained. This contract makes the pool, the
    /// per-season leaderboard, and the payout authoritative and on-chain.
    ///
    /// MODEL — an all-pay seasonal contest (no house fee, pure redistribution):
    ///   * Players "burn" GAS into the current season pool (deposit-then-act: GAS with
    ///     memo "miniapp-burnleague:burn" credits the sender, then burn(player, amount)
    ///     moves it into the pool and adds to the player's season total).
    ///   * The leaderboard is the players ranked by season total; the contract tracks the
    ///     single top burner in O(1). Front-ends rebuild the full board from Burned events.
    ///   * After the season deadline anyone may call settle(): the whole pool is credited
    ///     to the top burner for withdrawal (winner-takes-all), the season is recorded settled, and the next
    ///     season begins lazily on the next burn. No external settler, no oracle.
    ///
    /// Seasons start LAZILY on the first burn (the clock begins when play begins), so the
    /// lifecycle is independent of deploy time. Production seasons run for 24 hours,
    /// giving wallets time to confirm deposits/burns while keeping a daily competition cadence.
    ///
    /// No GAS is strandable: burned GAS rests only as the season pool (credited to the winner
    /// at settle) or as a player's reclaimable deposit credit (Withdraw).
    /// </summary>
    [DisplayName("MiniAppBurnLeague")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.1.0")]
    [ManifestExtra("Description", "Daily on-chain burn league: burn GAS into a 24-hour season pool, top burner wins pull-payment credit via permissionless settle — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppBurnLeague : SmartContract
    {
        #region Constants
        private const long MIN_BURN = 1_00000000;          // 1 GAS
        private const long MAX_BURN = 1000_00000000;       // 1000 GAS (per burn)
        private const ulong SEASON_DURATION = 86_400_000;  // 24 hours (ms)
        private const string BURN_MEMO = "miniapp-burnleague:burn";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 };        // contract owner (deployer)
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x10 };       // + player -> deposit credit
        private static readonly byte[] PREFIX_SEASON_ID = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_SEASON_END = new byte[] { 0x12 };   // ms; 0 = dormant
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_BURN_COUNT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_USER_BURNED = new byte[] { 0x15 };  // + seasonId + player -> burned this season
        private static readonly byte[] PREFIX_TOP_BURNER = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_TOP_BURNED = new byte[] { 0x17 };
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // player, amount, balance
        [DisplayName("SeasonStarted")]
        public static event Action<BigInteger, BigInteger> OnSeasonStarted; // seasonId, endTime
        [DisplayName("Burned")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnBurned; // seasonId, player, amount, userSeasonTotal
        [DisplayName("SeasonSettled")]
        public static event Action<BigInteger, UInt160, BigInteger> OnSeasonSettled; // seasonId, winner, pool
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Deposit
        /// <summary>GAS with memo "miniapp-burnleague:burn" credits the sender's burn balance.</summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == BURN_MEMO, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }
        #endregion

        #region Burn
        /// <summary>
        /// Burn `amount` from the player's prepaid credit into the current season pool.
        /// Starts a fresh season lazily if none is running. Returns the player's new
        /// season total.
        /// </summary>
        public static BigInteger Burn(UInt160 player, BigInteger amount)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(amount >= MIN_BURN && amount <= MAX_BURN, "burn out of range");

            StorageContext ctx = Storage.CurrentContext;

            BigInteger seasonId = (BigInteger)Storage.Get(ctx, PREFIX_SEASON_ID);
            BigInteger seasonEnd = (BigInteger)Storage.Get(ctx, PREFIX_SEASON_END);
            BigInteger now = Runtime.Time;

            if (seasonEnd == 0)
            {
                // Lazy season start: the clock begins on the first burn.
                if (seasonId == 0) seasonId = 1;
                seasonEnd = now + SEASON_DURATION;
                Storage.Put(ctx, PREFIX_SEASON_ID, seasonId);
                Storage.Put(ctx, PREFIX_SEASON_END, seasonEnd);
                OnSeasonStarted(seasonId, seasonEnd);
            }
            else
            {
                ExecutionEngine.Assert(now < seasonEnd, "season ended; settle first");
            }

            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient burn credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            Storage.Put(ctx, PREFIX_POOL, (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount);
            Storage.Put(ctx, PREFIX_BURN_COUNT, (BigInteger)Storage.Get(ctx, PREFIX_BURN_COUNT) + 1);

            byte[] userKey = Helper.Concat(Helper.Concat(PREFIX_USER_BURNED, (byte[])(ByteString)seasonId), (byte[])player);
            BigInteger userTotal = (BigInteger)Storage.Get(ctx, userKey) + amount;
            Storage.Put(ctx, userKey, userTotal);

            BigInteger topBurned = (BigInteger)Storage.Get(ctx, PREFIX_TOP_BURNED);
            if (userTotal > topBurned)
            {
                Storage.Put(ctx, PREFIX_TOP_BURNED, userTotal);
                Storage.Put(ctx, PREFIX_TOP_BURNER, player);
            }

            OnBurned(seasonId, player, amount, userTotal);
            return userTotal;
        }
        #endregion

        #region Settle
        /// <summary>
        /// After the season deadline, credit the whole pool to the top burner and end
        /// the season. Permissionless. The winner claims via Withdraw; the next season
        /// starts lazily on the next burn.
        /// </summary>
        public static void Settle()
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger seasonEnd = (BigInteger)Storage.Get(ctx, PREFIX_SEASON_END);
            ExecutionEngine.Assert(seasonEnd != 0, "no active season");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= seasonEnd, "season not ended");

            BigInteger seasonId = (BigInteger)Storage.Get(ctx, PREFIX_SEASON_ID);
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            ByteString winnerRaw = Storage.Get(ctx, PREFIX_TOP_BURNER);

            // Effects before interaction (CEI): close the season + advance the counter so
            // the next burn starts a clean season, and a settle can never run twice.
            Storage.Put(ctx, PREFIX_SEASON_ID, seasonId + 1);
            Storage.Put(ctx, PREFIX_SEASON_END, 0);
            Storage.Put(ctx, PREFIX_POOL, 0);
            Storage.Put(ctx, PREFIX_BURN_COUNT, 0);
            Storage.Delete(ctx, PREFIX_TOP_BURNER);
            Storage.Put(ctx, PREFIX_TOP_BURNED, 0);

            UInt160 winner = winnerRaw is null ? UInt160.Zero : (UInt160)winnerRaw;
            if (pool > 0 && winnerRaw is not null)
            {
                // PULL-PAYMENT: credit the winner instead of pushing GAS. A push to a winner
                // that is a contract rejecting incoming GAS would fail the assert and brick
                // settle() permanently — the season could never close, stranding the pool and
                // freezing all future seasons. Crediting can never block settlement; the
                // winner claims via Withdraw().
                byte[] wKey = Helper.Concat(PREFIX_CREDIT, (byte[])winner);
                BigInteger wbal = (BigInteger)Storage.Get(ctx, wKey) + pool;
                Storage.Put(ctx, wKey, wbal);
            }
            OnSeasonSettled(seasonId, winner, pool);
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid burn-credit back to the sender.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion
    }
}
