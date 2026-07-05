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
    /// MiniAppFlappyDash — settled through the generic Morpheus kernel: the
    /// puzzle is sealed inside the TEE session service, only a 32-byte commitment hash
    /// ever reaches the chain, and wins are paid against the kernel-verified finalize
    /// result (the kernel's shared RUNTIME_VERIFIER validates the TEE fulfillment, so
    /// the game trusts caller==oracle rather than a per-game signer).
    ///
    /// MODEL (GAS only, BASE UNITS, 1 GAS = 1e8): the player prepays entry credit
    /// (deposit-then-act, memo "miniapp-flappy-dash:entry"); startGame consumes the entry
    /// into the reward pool, reserves the fixed base reward (0.1 / 0.5 / 1 GAS by
    /// difficulty), sets the deadline and marks the game active. The player plays the
    /// interactive enclave session off-chain, then calls finalizeGame(gameId, sealed
    /// op-log) which submits ONE kernel request; the kernel replays the run, signs the
    /// result and delivers it to onMiniAppResult, which credits
    /// reward * (100 - 30 * undos) / 100 as a PULL-PAYMENT claim (withdraw()).
    ///
    /// TRUST MODEL: settlement trust is the kernel's shared RUNTIME_VERIFIER, checked
    /// inside the kernel's FulfillRequest before it calls this contract back. This
    /// contract only asserts caller==Oracle() and parses the fixed result codec.
    ///
    /// ABI NOTE: binary arguments (commitment, op-log) cross the ABI as LOWERCASE HEX
    /// STRINGS and are decoded on-chain — wallets disagree on hex-vs-base64 for
    /// ByteArray arguments, strings are unambiguous.
    ///
    /// LEADERBOARD: the full ranking is rebuilt off-chain from the Solved event
    /// (which carries the player's cumulative totalWon in its last slot); only the
    /// single top winner is stored on-chain (topPlayer()).
    ///
    /// SOLVENCY INVARIANT (asserted in tests):
    ///   heldGAS == pool + sum(player credits); reserved &lt;= pool.
    /// Every active game reserves its full base reward from the free pool at start,
    /// so every game that can still settle stays fully payable.
    /// </summary>
    [DisplayName("MiniAppFlappyDash")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "Endless flappy run settled through the generic Morpheus oracle kernel: run sealed in the TEE, kernel-verified finalize result, target-pipes payout, pull-payment winnings.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    [ContractPermission("*", "submitMiniAppRequestFromIntegration")] // Morpheus oracle kernel
    public partial class MiniAppFlappyDash : SmartContract
    {
        #region Constants (base units / time)
        private const string FUND_MEMO = "miniapp-flappy-dash:fund";
        private const string ENTRY_MEMO = "miniapp-flappy-dash:entry";
        private const string APP_ID = "miniapp-flappy-dash";
        private const string MODULE_ID = "game.session";
        private const string OP_FINALIZE = "session.finalize";
        private const int MAX_UNDOS = 3;
        private const int UNDO_PENALTY_PCT = 30;      // each undo removes 30% of the BASE reward
        private const long SETTLE_GRACE_MS = 600_000; // an abandoned settling game recovers after grace
        private const int DEFAULT_DAILY_CAP = 8;      // starts per player per UTC day (owner-tunable)
        private const long MS_PER_DAY = 86_400_000;

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Per-difficulty lookups (0 easy, 1 medium, 2 hard)
        private static BigInteger EntryOf(BigInteger d)
        {
            if (d == 0) return 2_000_000;
            if (d == 1) return 10_000_000;
            return 20_000_000;
        }

        private static BigInteger RewardOf(BigInteger d)
        {
            if (d == 0) return 10_000_000;
            if (d == 1) return 50_000_000;
            return 100_000_000;
        }

        private static BigInteger LimitMsOf(BigInteger d)
        {
            if (d == 0) return 120_000;
            if (d == 1) return 180_000;
            return 300_000;
        }

        private static BigInteger MinSolveMsOf(BigInteger d)
        {
            if (d == 0) return 20_000;
            if (d == 1) return 30_000;
            return 45_000;
        }

        private static BigInteger TargetScoreOf(BigInteger d)
        {
            if (d == 0) return 5;
            if (d == 1) return 10;
            return 20;
        }
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
        private static readonly byte[] PREFIX_ORACLE = new byte[] { 0x1C };    // the Morpheus oracle kernel hash
        private static readonly byte[] PREFIX_REQUEST = new byte[] { 0x1D };   // + requestId -> gameId (finalize context)
        #endregion

        #region Types
        public struct Game
        {
            public UInt160 Player;
            public BigInteger Difficulty;
            public BigInteger Entry;
            public BigInteger Reward;
            public BigInteger StartTime;
            public ByteString Commitment;  // "" until settled; sha256 of the TEE problem canonical
            public BigInteger DealtAt;
            public BigInteger Deadline;
            public BigInteger Undos;       // TEE-tracked; recorded from the finalize result
            public BigInteger Status;      // 1 in play, 2 settled, 3 expired, 4 refunded, 5 settling
            public BigInteger Payout;
            public BigInteger SolveMs;
            public ByteString AnswerHash;  // "" until settled; sha256 of the canonical answer
            public BigInteger Score;       // TEE-attested achievement metric from the finalize result
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
        [DisplayName("Finalizing")]
        public static event Action<BigInteger, UInt160, BigInteger> OnFinalizing; // gameId, player, requestId
        // Solved slot order is the LEADERBOARD API — the frontend rebuilds rankings from
        // slots 1 (player) and 6 (totalWon). Do not reorder.
        [DisplayName("Solved")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger, BigInteger, BigInteger> OnSolved; // gameId, player, difficulty, elapsedMs, pipesPassed, payout, totalWon
        [DisplayName("GameExpired")]
        public static event Action<BigInteger, UInt160, BigInteger> OnGameExpired; // gameId, player, difficulty
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        [DisplayName("PoolWithdrawn")]
        public static event Action<UInt160, BigInteger> OnPoolWithdrawn; // to, amount
        [DisplayName("PausedChanged")]
        public static event Action<bool> OnPausedChanged;
        [DisplayName("DailyCapChanged")]
        public static event Action<BigInteger> OnDailyCapChanged;
        [DisplayName("OracleChanged")]
        public static event Action<UInt160> OnOracleChanged;
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

        /// <summary>Register or rotate the Morpheus oracle kernel this game settles through.</summary>
        public static void SetOracle(UInt160 oracle)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(oracle is not null && oracle.IsValid && !oracle.IsZero, "invalid oracle");
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
            OnOracleChanged(oracle);
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

        /// <summary>Owner-gated in-place upgrade so fixes can be applied.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, null);
        }
        #endregion
    }
}
