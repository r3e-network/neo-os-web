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
    /// MiniAppSheepSolitaire — timed card-matching skill game with private TEE
    /// settlement. The card layout is sealed inside the Morpheus TEE; only a 32-byte
    /// commitment reaches the chain, and wins pay against a secp256r1 settlement
    /// signature the contract verifies.
    ///
    /// GAMEPLAY (in the TEE): cards stack in 3 layers; players pick cards into a
    /// 7-slot bar and 3 matching cards auto-eliminate; full slots = game over.
    /// Tools — Undo (penalty), Shuffle, Remove 3. The TEE generates the layout; the
    /// client only sees uncovered cards.
    ///
    /// MODEL (GAS only, BASE UNITS, 1 GAS = 1e8): the player prepays entry credit
    /// (deposit-then-act, memo "miniapp-sheep-solitaire:entry"); startGame consumes
    /// it into the reward pool and reserves the fixed base reward (0.1 / 0.5 / 1 GAS
    /// by difficulty). The TEE derives the puzzle from a secret it never reveals and
    /// signs a bind attestation; PERMISSIONLESS bindPuzzle verifies it and stores the
    /// commitment (sha256 of the TEE problem canonical), starting the solve clock.
    /// Gameplay incl. tool usage is tracked in the TEE; the board never appears
    /// on-chain. settleVerified carries the problem hash (== the bound commitment),
    /// answer hash, TEE-clocked elapsedMs and undo count in one 64-byte signature;
    /// after verification it credits reward * (100 - 30 * undos) / 100 as a
    /// PULL-PAYMENT claim (withdraw()).
    ///
    /// TRUST MODEL: the owner-registered TEE session signer is the verification root.
    /// Each signature covers a domain-separated Sha256 digest pinning this contract
    /// hash and the network magic, so a settlement cannot be forged, replayed across
    /// deployments/networks, or re-pointed at another puzzle, player, time or undo
    /// count. The TEE only signs wins; losses expire on-chain (refunded if unbound).
    ///
    /// ABI NOTE: binary args cross the ABI as LOWERCASE HEX STRINGS decoded on-chain
    /// (wallets disagree on hex-vs-base64 for ByteArray). LEADERBOARD: rebuilt
    /// off-chain from the Solved event (last slot = cumulative totalWon); only
    /// topPlayer() is stored on-chain. SOLVENCY (asserted in tests): heldGAS == pool
    /// + sum(credits) and reserved &lt;= pool — every active game reserves its reward.
    /// </summary>
    [DisplayName("MiniAppSheepSolitaire")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Timed card-matching skill game with private TEE settlement: card layout sealed in the TEE, commitment hash bound on-chain, secp256r1-verified win settlement, TEE-tracked penalized tool usage, pull-payment winnings.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppSheepSolitaire : SmartContract
    {
        #region Constants (base units / time)
        private const string FUND_MEMO = "miniapp-sheep-solitaire:fund";
        private const string ENTRY_MEMO = "miniapp-sheep-solitaire:entry";
        private const int MAX_UNDOS = 3;
        private const int UNDO_PENALTY_PCT = 30;      // each undo removes 30% of the BASE reward
        private const long DEAL_TTL_MS = 3_600_000;   // unbound games refundable after 1h
        private const long SETTLE_GRACE_MS = 600_000; // settle txs may land after a near-deadline TEE signature
        private const int DEFAULT_DAILY_CAP = 8;      // starts per player per UTC day (owner-tunable)
        private const long MS_PER_DAY = 86_400_000;

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Per-difficulty lookups (0 easy, 1 medium, 2 hard)
        private static BigInteger EntryOf(BigInteger d)
        {
            if (d == 0) return 2_000_000;   // 0.02 GAS
            if (d == 1) return 10_000_000;  // 0.10 GAS
            return 20_000_000;              // 0.20 GAS
        }

        private static BigInteger RewardOf(BigInteger d)
        {
            if (d == 0) return 10_000_000;  // 0.1 GAS
            if (d == 1) return 50_000_000;  // 0.5 GAS
            return 100_000_000;             // 1 GAS
        }

        private static BigInteger LimitMsOf(BigInteger d)
        {
            if (d == 0) return 300_000;     // 5 min
            if (d == 1) return 480_000;     // 8 min
            return 720_000;                 // 12 min
        }

        private static BigInteger MinSolveMsOf(BigInteger d)
        {
            if (d == 0) return 60_000;      // bot-deterrent floor: 60s
            if (d == 1) return 120_000;     // 120s
            return 180_000;                 // 180s
        }

        private static BigInteger TargetCardTypesOf(BigInteger d)
        {
            if (d == 0) return 8;
            if (d == 1) return 12;
            return 15;
        }

        private static BigInteger MaxLayersOf(BigInteger d) => 3; // all difficulties use 3 layers
        #endregion
        #region Storage prefixes
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x10 };      // reward pool balance (includes entries)
        private static readonly byte[] PREFIX_RESERVED = new byte[] { 0x11 };  // sum of base rewards held by active games
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x12 };    // + player -> prepaid entries + won payouts
        private static readonly byte[] PREFIX_GAME_ID = new byte[] { 0x13 };   // last game id
        private static readonly byte[] PREFIX_GAME = new byte[] { 0x14 };      // + gameId -> Game
        private static readonly byte[] PREFIX_ACTIVE = new byte[] { 0x15 };    // + player -> unfinished gameId
        private static readonly byte[] PREFIX_STATS = new byte[] { 0x16 };     // + player -> Stats
        private static readonly byte[] PREFIX_TOP_ADDR = new byte[] { 0x17 };  // current champion address
        private static readonly byte[] PREFIX_TOP_WON = new byte[] { 0x18 };   // champion's cumulative winnings
        private static readonly byte[] PREFIX_DAY = new byte[] { 0x19 };       // + dayNumber + player -> starts today
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x1A };
        private static readonly byte[] PREFIX_DAILY_CAP = new byte[] { 0x1B }; // 0/absent -> DEFAULT_DAILY_CAP
        private static readonly byte[] PREFIX_TEE_PUB = new byte[] { 0x1C };   // compressed secp256r1 TEE session signer
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x1D }; // upgrade timelock execution timestamp
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x1E }; // sha256(nef ++ manifest) commitment
        #endregion

        #region Upgrade timelock
        private const long UPGRADE_TIMELOCK_MS = 86_400_000; // 24 hours
        #endregion

        #region Types
        public struct Game
        {
            public UInt160 Player;
            public BigInteger Difficulty;
            public BigInteger Entry;
            public BigInteger Reward;
            public BigInteger StartTime;
            public ByteString Commitment;  // "" until bound; sha256 of the TEE problem canonical
            public BigInteger DealtAt;
            public BigInteger Deadline;
            public BigInteger Undos;       // TEE-tracked; recorded from the settlement signature
            public BigInteger Status;      // 0 awaiting bind, 1 in play, 2 solved, 3 expired, 4 refunded
            public BigInteger Payout;
            public BigInteger SolveMs;
            public ByteString AnswerHash;  // "" until solved; sha256 of the canonical answer
        }

        public struct Stats
        {
            public BigInteger Played;
            public BigInteger Solved;
            public BigInteger TotalWon;
        }
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("PoolFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnPoolFunded; // from, amount, pool
        [DisplayName("GameStarted")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnGameStarted; // gameId, player, difficulty, entry, startTime
        [DisplayName("PuzzleBound")]
        public static event Action<BigInteger, UInt160, string, BigInteger, BigInteger> OnPuzzleBound; // gameId, player, commitmentHex, dealtAt, deadline
        // Solved slot order is the LEADERBOARD API — the frontend rebuilds rankings from
        // slots 1 (player) and 6 (totalWon). Do not reorder.
        [DisplayName("Solved")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger, BigInteger, BigInteger> OnSolved; // gameId, player, difficulty, elapsedMs, undos, payout, totalWon
        [DisplayName("GameExpired")]
        public static event Action<BigInteger, UInt160, BigInteger> OnGameExpired; // gameId, player, difficulty
        [DisplayName("GameRefunded")]
        public static event Action<BigInteger, UInt160, BigInteger> OnGameRefunded; // gameId, player, entry
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        [DisplayName("PoolWithdrawn")]
        public static event Action<UInt160, BigInteger> OnPoolWithdrawn; // to, amount
        [DisplayName("PausedChanged")]
        public static event Action<bool> OnPausedChanged;
        [DisplayName("DailyCapChanged")]
        public static event Action<BigInteger> OnDailyCapChanged;
        [DisplayName("TeeSignerChanged")]
        public static event Action<ECPoint> OnTeeSignerChanged;
        [DisplayName("UpgradeScheduled")]
        public static event Action<BigInteger> OnUpgradeScheduled; // executeAfter
        #endregion

        #region Deposit (pool funding + entry credit) — CREDIT ONLY, no transfers/business logic
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;
            StorageContext ctx = Storage.CurrentContext;

            if (memo == FUND_MEMO)
            {
                BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount;
                Storage.Put(ctx, PREFIX_POOL, pool);
                OnPoolFunded(from, amount, pool);
                return;
            }
            if (memo == ENTRY_MEMO)
            {
                byte[] key = CreditKey(from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnCredited(from, amount, bal);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Admin (owner-gated)
        /// <summary>Pause / unpause new game starts.</summary>
        public static void SetPaused(bool paused)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
            OnPausedChanged(paused);
        }

        /// <summary>Tune the per-player daily start cap (1..100).</summary>
        public static void SetDailyCap(BigInteger cap)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(cap >= 1 && cap <= 100, "cap must be 1..100");
            Storage.Put(Storage.CurrentContext, PREFIX_DAILY_CAP, cap);
            OnDailyCapChanged(cap);
        }

        /// <summary>Register or rotate the TEE session signer (33-byte compressed secp256r1 key).</summary>
        public static void SetTeeSigner(ECPoint signer)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(signer is not null && signer.IsValid, "invalid signer key");
            Storage.Put(Storage.CurrentContext, PREFIX_TEE_PUB, (byte[])signer);
            OnTeeSignerChanged(signer);
        }

        /// <summary>
        /// Owner-only pool withdrawal. Never withdraws funds reserved against active
        /// games, so every solvable game stays fully payable.
        /// </summary>
        public static void WithdrawPool(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            ExecutionEngine.Assert(pool - reserved >= amount, "insufficient free pool");
            // Effects before interaction.
            Storage.Put(ctx, PREFIX_POOL, pool - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "pool transfer failed");
            OnPoolWithdrawn(to, amount);
        }

        /// <summary>
        /// Owner-gated upgrade with 24-hour timelock. Schedules the upgrade for
        /// execution after the timelock delay. The upgrade data hash is committed
        /// on-chain so the actual upgrade act is bound to the scheduled parameters.
        /// </summary>
        public static void ScheduleUpgrade(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            BigInteger executeAt = Runtime.Time + UPGRADE_TIMELOCK_MS;
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_TIME, executeAt);
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_HASH,
                CryptoLib.Sha256(Helper.Concat((ByteString)nef, (ByteString)manifest)));
            OnUpgradeScheduled(executeAt);
        }

        /// <summary>
        /// Execute a previously scheduled upgrade after the timelock has elapsed.
        /// The caller must supply the identical nef and manifest that were committed
        /// in ScheduleUpgrade. Permissionless — anyone can trigger the upgrade once
        /// the timelock expires.
        /// </summary>
        public static void Update(ByteString nef, string manifest)
        {
            BigInteger executeAt = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            ExecutionEngine.Assert(executeAt > 0, "no upgrade scheduled");
            ExecutionEngine.Assert(Runtime.Time >= executeAt, "timelock active");

            ByteString expectedHash = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ByteString actualHash = CryptoLib.Sha256(Helper.Concat((ByteString)nef, (ByteString)manifest));
            ExecutionEngine.Assert(expectedHash == actualHash, "upgrade data mismatch");

            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);

            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion
    }
}