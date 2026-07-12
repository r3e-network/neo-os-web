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
    /// MiniAppLastSurvivor — self-contained on-chain "last survivor" pot game (NO oracle).
    ///
    /// WHY: the app previously routed buy/settle through the OS game/payment kernel,
    /// which never actually held a pot or paid a winner. This contract is the
    /// authoritative implementation: players buy keys on a rising bonding curve, each
    /// key adds its cost to the round pot and pushes the countdown out; when the
    /// countdown expires the LAST buyer wins the entire pot as pull-payment credit,
    /// and a fresh round begins. No privileged settler and no payout deadlock.
    ///
    /// KEY PRICE (must match the frontend formula exactly, all base units):
    ///   commonDiff   = BASE_KEY_PRICE * 10 / 10000        (= 0.1% of base per key)
    ///   firstPrice   = BASE_KEY_PRICE + totalKeys * commonDiff
    ///   cost(count)  = count*firstPrice + (count*(count-1)/2)*commonDiff
    ///
    /// TIMER: each key extends the countdown by EXTEND_PER_KEY, capped so the
    /// remaining time never exceeds MAX_DURATION; the first key of a round starts the
    /// clock from now. When now >= endTime (and the round has keys) the round is over
    /// and settle() pays the last buyer and rolls to the next round.
    ///
    /// SAFETY:
    /// - GAS only; amounts in BASE UNITS (1 GAS = 100_000_000).
    /// - Deposit-then-buy: GAS sent with memo "miniapp-lastsurvivor:buy" credits the
    ///   sender; buyKeys consumes that credit, so the pot is always fully funded.
    /// - settle() is permissionless and CREDITS the recorded last buyer (claimed via
    ///   Withdraw), never pushing GAS — a push to a GAS-rejecting contract winner would
    ///   brick settle() and strand the pot. Round state advances before crediting (CEI),
    ///   so the game can never deadlock on an inactive winner or settle twice.
    /// </summary>
    [DisplayName("MiniAppLastSurvivor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.1.0")]
    [ManifestExtra("Description", "Self-contained on-chain last-survivor pot game: rising key price, timer extension, permissionless settlement, and winner pull-payment credit — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppLastSurvivor : SmartContract
    {
        #region Constants (base units / milliseconds)
        private const long BASE_KEY_PRICE = 10_000_000;       // 0.1 GAS
        private const long COMMON_DIFF = BASE_KEY_PRICE * 10 / 10000; // 0.1% of base per key = 10_000
        private const long EXTEND_PER_KEY_MS = 30_000;        // +30s per key
        private const long MAX_DURATION_MS = 86_400_000;      // 24h cap on remaining time
        private const int MAX_KEYS_PER_BUY = 1000;
        private const string BUY_MEMO = "miniapp-lastsurvivor:buy";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x01 };        // contract owner (deployer)
        private static readonly byte[] PREFIX_CUR_ROUND = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x11 };        // + roundId -> Round
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };       // + player -> GAS credit
        private static readonly byte[] PREFIX_PLAYER_KEYS = new byte[] { 0x13 };  // + roundId + player -> keys
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("KeysBought")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger, BigInteger> OnKeysBought; // round, player, count, cost, pot, endTime
        [DisplayName("RoundSettled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnRoundSettled; // round, winner, pot, nextRound
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Types
        public struct Round
        {
            public BigInteger Id;
            public BigInteger Pot;
            public BigInteger TotalKeys;
            public UInt160 LastBuyer;
            public BigInteger EndTime;   // ms; 0 until the first key is bought
            public bool Settled;
        }
        #endregion

        #region Deposit (prepaid buy credit)
        /// <summary>
        /// GAS sent with memo "miniapp-lastsurvivor:buy" credits the sender's prepaid
        /// balance, which buyKeys() then consumes.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == BUY_MEMO, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }
        #endregion

        #region Buy
        /// <summary>
        /// Buy `count` keys in the current round at the rising bonding-curve price,
        /// funded from the player's prepaid credit. Adds the cost to the pot, makes
        /// the player the last buyer, and extends the countdown.
        /// </summary>
        public static BigInteger BuyKeys(UInt160 player, BigInteger count)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(count > 0 && count <= MAX_KEYS_PER_BUY, "count 1..1000");

            StorageContext ctx = Storage.CurrentContext;
            BigInteger roundId = CurrentRoundId(ctx);
            Round r = LoadRound(ctx, roundId);

            BigInteger now = (BigInteger)Runtime.Time;
            // A round with keys whose clock has expired must be settled before more
            // buys; a fresh round (TotalKeys == 0) has no clock yet.
            if (r.TotalKeys > 0)
                ExecutionEngine.Assert(now < r.EndTime, "round ended; settle first");

            BigInteger cost = KeyCost(r.TotalKeys, count);

            // Consume prepaid credit.
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= cost, "insufficient deposit credit");
            BigInteger nextCredit = credit - cost;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // Extend the countdown: base is now for the first key, else the live
            // endTime; cap remaining time at MAX_DURATION from now.
            BigInteger basis = r.TotalKeys == 0 ? now : r.EndTime;
            BigInteger newEnd = basis + count * EXTEND_PER_KEY_MS;
            BigInteger cap = now + MAX_DURATION_MS;
            if (newEnd > cap) newEnd = cap;

            r.Pot += cost;
            r.TotalKeys += count;
            r.LastBuyer = player;
            r.EndTime = newEnd;
            Storage.Put(ctx, RoundKey(roundId), StdLib.Serialize(r));

            // Per-player key tally for the round.
            byte[] pkKey = PlayerKeysKey(roundId, player);
            BigInteger pk = (BigInteger)Storage.Get(ctx, pkKey) + count;
            Storage.Put(ctx, pkKey, pk);

            OnKeysBought(roundId, player, count, cost, r.Pot, r.EndTime);
            return cost;
        }
        #endregion

        #region Settle
        /// <summary>
        /// Permissionless: once the current round's countdown has expired, credit the
        /// recorded last buyer with the entire pot and roll to a fresh round.
        /// </summary>
        public static BigInteger Settle()
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger roundId = CurrentRoundId(ctx);
            Round r = LoadRound(ctx, roundId);

            ExecutionEngine.Assert(r.TotalKeys > 0, "round has no keys");
            ExecutionEngine.Assert(!r.Settled, "already settled");
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= r.EndTime, "round still active");

            UInt160 winner = r.LastBuyer;
            BigInteger pot = r.Pot;

            // Effects: settle this round and advance to the next BEFORE paying out.
            r.Settled = true;
            Storage.Put(ctx, RoundKey(roundId), StdLib.Serialize(r));
            BigInteger nextRound = roundId + 1;
            Storage.Put(ctx, PREFIX_CUR_ROUND, nextRound);

            if (pot > 0) // pull-payment: credit the winner (claimed via Withdraw), never push
            {
                byte[] wKey = Helper.Concat(PREFIX_CREDIT, (byte[])winner);
                Storage.Put(ctx, wKey, (BigInteger)Storage.Get(ctx, wKey) + pot);
            }

            OnRoundSettled(roundId, winner, pot, nextRound);
            return pot;
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid buy-credit back to the sender.</summary>
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

        #region Read-only
        [Safe]
        public static BigInteger CurrentRoundId() => CurrentRoundId(Storage.CurrentContext);

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));

        [Safe]
        public static BigInteger PlayerKeys(BigInteger roundId, UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PlayerKeysKey(roundId, player));

        /// <summary>Cost to buy `count` keys when the round already has `totalKeys`.</summary>
        [Safe]
        public static BigInteger KeyCost(BigInteger totalKeys, BigInteger count)
        {
            if (count <= 0) return 0;
            BigInteger firstPrice = BASE_KEY_PRICE + totalKeys * COMMON_DIFF;
            BigInteger baseCost = count * firstPrice;
            BigInteger incrementCost = (count * (count - 1) / 2) * COMMON_DIFF;
            return baseCost + incrementCost;
        }

        /// <summary>Cost to buy `count` keys in the CURRENT round right now.</summary>
        [Safe]
        public static BigInteger CurrentKeyCost(BigInteger count)
        {
            Round r = LoadRound(Storage.CurrentContext, CurrentRoundId(Storage.CurrentContext));
            return KeyCost(r.TotalKeys, count);
        }

        [Safe]
        public static Map<string, object> GetCurrentRound() =>
            RoundMap(LoadRound(Storage.CurrentContext, CurrentRoundId(Storage.CurrentContext)));

        [Safe]
        public static Map<string, object> GetRound(BigInteger roundId) =>
            RoundMap(LoadRound(Storage.CurrentContext, roundId));
        #endregion

        #region Internal
        private static BigInteger CurrentRoundId(StorageContext ctx)
        {
            BigInteger id = (BigInteger)Storage.Get(ctx, PREFIX_CUR_ROUND);
            return id == 0 ? 1 : id; // rounds are 1-based; round 1 is the genesis round
        }

        private static Round LoadRound(StorageContext ctx, BigInteger roundId)
        {
            ByteString raw = Storage.Get(ctx, RoundKey(roundId));
            if (raw is null)
            {
                // A round that has never been touched is a fresh, empty, active round.
                return new Round
                {
                    Id = roundId, Pot = 0, TotalKeys = 0,
                    LastBuyer = UInt160.Zero, EndTime = 0, Settled = false,
                };
            }
            return (Round)StdLib.Deserialize(raw);
        }

        private static Map<string, object> RoundMap(Round r)
        {
            BigInteger now = (BigInteger)Runtime.Time;
            bool active = r.TotalKeys == 0 || (!r.Settled && now < r.EndTime);
            BigInteger remainingMs = (r.TotalKeys > 0 && r.EndTime > now) ? r.EndTime - now : 0;
            Map<string, object> m = new Map<string, object>();
            m["roundId"] = r.Id;
            m["pot"] = r.Pot;
            m["totalKeys"] = r.TotalKeys;
            m["lastBuyer"] = r.LastBuyer;
            m["endTime"] = r.EndTime;
            m["settled"] = r.Settled;
            m["active"] = active;
            m["remainingTime"] = remainingMs / 1000; // seconds
            return m;
        }

        private static byte[] RoundKey(BigInteger id) => Helper.Concat(PREFIX_ROUND, (byte[])(ByteString)id);
        private static byte[] PlayerKeysKey(BigInteger roundId, UInt160 player) =>
            Helper.Concat(Helper.Concat(PREFIX_PLAYER_KEYS, (byte[])(ByteString)roundId), (byte[])player);
        #endregion
    }
}
