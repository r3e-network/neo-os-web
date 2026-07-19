using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformGame — RewardGame module (gameType 5)
    //
    //  Absorbs the TEE skill-game clones (MiniAppAimMaster, MiniAppSudoku,
    //  et al.) as tenants of this engine, per docs/platform-contract-library-v2.md
    //  section 3.3. The ABI is the clone ABI verbatim with appId first:
    //  startGame / finalizeGame / expireGame / withdraw, reads freePool /
    //  creditOf / activeGameOf / getGame / statsOf, events Solved /
    //  GameStarted / GameExpired / CreditWithdrawn with appId in slot 0
    //  (declared here on the concrete class, per the compiler constraint).
    //
    //  MODEL (GAS only, base units): per-app sub-ledgers track the reward
    //  pool (entries + funding), rewards reserved by active games, and
    //  player credits (prepaid entries + won payouts). The MANDATORY
    //  liability counter heldForApp moves only on the external lanes
    //  (fund / entry deposit / withdraw), so the solvency identity
    //      heldForApp == freePool + reserved + sum(credits)
    //  holds after every call (pool carries reservations: reserved <= pool).
    //  Settlement trust is the Morpheus kernel's RUNTIME_VERIFIER; this
    //  contract asserts caller == Oracle() and parses the fixed 79-byte
    //  result codec (the Settle partial).
    // ===================================================================

    // ---- RewardGame event delegates (appId always in slot 0) ----
    public delegate void RewardGameFundedHandler(string appId, UInt160 from, BigInteger amount, BigInteger pool);
    public delegate void RewardGameCreditedHandler(string appId, UInt160 from, BigInteger amount, BigInteger balance);
    public delegate void RewardGameStartedHandler(string appId, BigInteger gameId, UInt160 player, BigInteger difficulty, BigInteger entry, BigInteger startTime);
    public delegate void RewardGameFinalizingHandler(string appId, BigInteger gameId, UInt160 player, BigInteger requestId);
    public delegate void RewardGameSolvedHandler(string appId, BigInteger gameId, UInt160 player, BigInteger difficulty, BigInteger elapsedMs, BigInteger score, BigInteger payout, BigInteger totalWon);
    public delegate void RewardGameExpiredHandler(string appId, BigInteger gameId, UInt160 player, BigInteger difficulty);
    public delegate void RewardGameCreditWithdrawnHandler(string appId, UInt160 account, BigInteger amount);

    public partial class PlatformGameContract
    {
        // ---- module storage prefixes (0xF0-0xFF), appId-namespaced via AppKey ----
        private static readonly byte[] RG_PREFIX_POOL = new byte[] { 0xF0 };      // reward pool (includes entries and reservations)
        private static readonly byte[] RG_PREFIX_RESERVED = new byte[] { 0xF1 };  // base rewards held by active games
        private static readonly byte[] RG_PREFIX_CREDIT = new byte[] { 0xF2 };    // + player -> prepaid entries + won payouts
        private static readonly byte[] RG_PREFIX_HELD = new byte[] { 0xF3 };      // liability counter: pool + sum(credits)
        private static readonly byte[] RG_PREFIX_GAME_ID = new byte[] { 0xF4 };   // last game id
        private static readonly byte[] RG_PREFIX_GAME = new byte[] { 0xF5 };      // + gameId -> RewardGame
        private static readonly byte[] RG_PREFIX_ACTIVE = new byte[] { 0xF6 };    // + player -> unfinished gameId
        private static readonly byte[] RG_PREFIX_STATS = new byte[] { 0xF7 };     // + player -> RewardStats
        private static readonly byte[] RG_PREFIX_DAY = new byte[] { 0xF8 };       // + dayNumber + player -> starts today
        private static readonly byte[] RG_PREFIX_REQUEST = new byte[] { 0xF9 };   // + requestId -> gameId (finalize context)
        private static readonly byte[] RG_PREFIX_ECONOMICS = new byte[] { 0xFA }; // per-app descriptor economics row

        // Morpheus kernel routing constants — one canonical copy (design 3.3).
        private const string RG_MODULE_ID = "game.session";
        private const string RG_OP_FINALIZE = "session.finalize";
        private const int RG_MAX_UNDOS = 3;
        private const long RG_MS_PER_DAY = 86_400_000;

        #region Types
        public struct RewardGame
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

        public struct RewardStats
        {
            public BigInteger Played;
            public BigInteger Solved;
            public BigInteger TotalWon;
        }
        #endregion

        #region Events (the clone vocabulary, appId first)
        [DisplayName("PoolFunded")]
        public static event RewardGameFundedHandler OnRewardPoolFunded;
        [DisplayName("Credited")]
        public static event RewardGameCreditedHandler OnRewardCredited;
        [DisplayName("GameStarted")]
        public static event RewardGameStartedHandler OnRewardGameStarted;
        [DisplayName("Finalizing")]
        public static event RewardGameFinalizingHandler OnRewardFinalizing;
        // Slot order after appId is the clone LEADERBOARD API (player, then
        // totalWon last) — the frontend rebuilds rankings from it. Do not reorder.
        [DisplayName("Solved")]
        public static event RewardGameSolvedHandler OnRewardSolved;
        [DisplayName("GameExpired")]
        public static event RewardGameExpiredHandler OnRewardGameExpired;
        [DisplayName("CreditWithdrawn")]
        public static event RewardGameCreditWithdrawnHandler OnRewardCreditWithdrawn;
        #endregion

        #region Deposit routing (gameType-5 branch of OnNEP17Payment) — CREDIT ONLY
        // Memo grammar: "appId:fund" tops up the pool, "appId:entry" prepays
        // a player's entry credit; both bump the liability counter.
        private static void CreditRewardGamePayment(string appId, UInt160 from, BigInteger amount, string memo)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            StorageContext ctx = Storage.CurrentContext;
            if (memo == appId + ":fund")
            {
                byte[] poolKey = AppKey(appId, RG_PREFIX_POOL);
                BigInteger pool = (BigInteger)Storage.Get(ctx, poolKey) + amount;
                Storage.Put(ctx, poolKey, pool);
                AdjustRewardHeld(appId, amount);
                OnRewardPoolFunded(appId, from, amount, pool);
                return;
            }
            if (memo == appId + ":entry")
            {
                byte[] creditKey = AppKey(appId, RG_PREFIX_CREDIT, from);
                BigInteger balance = (BigInteger)Storage.Get(ctx, creditKey) + amount;
                Storage.Put(ctx, creditKey, balance);
                AdjustRewardHeld(appId, amount);
                OnRewardCredited(appId, from, amount, balance);
                return;
            }
            ExecutionEngine.Assert(false, "invalid payment memo");
        }
        #endregion

        #region StartGame (pay entry, reserve reward, start the solve clock)
        /// <summary>
        /// Start a skill-game challenge: consumes the per-difficulty entry
        /// from the player's prepaid credit into the app's reward pool,
        /// reserves the full base reward from the free pool, and marks the
        /// game active. The puzzle lives inside the TEE session service;
        /// only the kernel-verified finalize result settles it. Returns the gameId.
        /// </summary>
        public static BigInteger StartGame(string appId, UInt160 player, BigInteger difficulty)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_RewardGame);
            RequireRegistryNotPaused(appId);
            ExecutionEngine.Assert(difficulty >= 0 && difficulty <= 2, "difficulty must be 0..2");
            ValidateAddress(player);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            StorageContext ctx = Storage.CurrentContext;
            byte[] activeKey = AppKey(appId, RG_PREFIX_ACTIVE, player);
            ExecutionEngine.Assert(Storage.Get(ctx, activeKey) is null, "finish your active game first");

            RewardEconomics econ = LoadEconomics(appId);

            // Per-UTC-day start cap (dayNumber = Runtime.Time / 86_400_000).
            BigInteger day = (BigInteger)Runtime.Time / RG_MS_PER_DAY;
            byte[] dayKey = RewardDayKey(appId, day, player);
            BigInteger startsToday = (BigInteger)Storage.Get(ctx, dayKey);
            ExecutionEngine.Assert(startsToday < econ.DailyCap, "daily start cap reached");
            Storage.Put(ctx, dayKey, startsToday + 1);

            // The entry funds the pool.
            BigInteger entry = RewardEntryOf(econ, difficulty);
            byte[] creditKey = AppKey(appId, RG_PREFIX_CREDIT, player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= entry, "insufficient entry credit — deposit first");
            BigInteger nextCredit = credit - entry;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);
            byte[] poolKey = AppKey(appId, RG_PREFIX_POOL);
            BigInteger pool = (BigInteger)Storage.Get(ctx, poolKey) + entry;
            Storage.Put(ctx, poolKey, pool);

            // Reserve the full base reward so this game stays payable.
            BigInteger reward = RewardBaseOf(econ, difficulty);
            byte[] reservedKey = AppKey(appId, RG_PREFIX_RESERVED);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, reservedKey);
            ExecutionEngine.Assert(pool - reserved >= reward, "reward pool cannot cover this game");
            Storage.Put(ctx, reservedKey, reserved + reward);

            byte[] gameIdKey = AppKey(appId, RG_PREFIX_GAME_ID);
            BigInteger gameId = (BigInteger)Storage.Get(ctx, gameIdKey) + 1;
            Storage.Put(ctx, gameIdKey, gameId);

            BigInteger now = Runtime.Time;
            RewardGame g = new RewardGame
            {
                Player = player,
                Difficulty = difficulty,
                Entry = entry,
                Reward = reward,
                StartTime = now,
                Commitment = "",
                DealtAt = now,
                Deadline = now + RewardLimitMsOf(econ, difficulty),
                Undos = 0,
                Status = 1,
                Payout = 0,
                SolveMs = 0,
                AnswerHash = "",
                Score = 0,
            };
            Storage.Put(ctx, AppKey(appId, RG_PREFIX_GAME, gameId), StdLib.Serialize(g));
            Storage.Put(ctx, activeKey, gameId);

            RewardStats s = LoadRewardStats(ctx, appId, player);
            s.Played += 1;
            Storage.Put(ctx, AppKey(appId, RG_PREFIX_STATS, player), StdLib.Serialize(s));

            OnRewardGameStarted(appId, gameId, player, difficulty, entry, now);
            return gameId;
        }
        #endregion

        #region ExpireGame (release the reservation of a game that can no longer settle) — PERMISSIONLESS
        /// <summary>
        /// Close a game that can no longer settle: an active (Status 1) or
        /// abandoned settling (Status 5) game past its deadline plus the
        /// app's settle grace releases its reservation (Status 3).
        /// Permissionless and pause-immune. Returns the new status.
        /// </summary>
        public static BigInteger ExpireGame(string appId, BigInteger gameId)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_RewardGame);
            StorageContext ctx = Storage.CurrentContext;
            RewardGame g = LoadRewardGame(ctx, appId, gameId);
            RewardEconomics econ = LoadEconomics(appId);
            BigInteger now = Runtime.Time;

            if ((g.Status == 1 || g.Status == 5) && now > g.Deadline + econ.SettleGraceMs)
            {
                Storage.Put(ctx, AppKey(appId, RG_PREFIX_RESERVED),
                    (BigInteger)Storage.Get(ctx, AppKey(appId, RG_PREFIX_RESERVED)) - g.Reward);
                ClearRewardActive(ctx, appId, g.Player, gameId);
                g.Status = 3;
                Storage.Put(ctx, AppKey(appId, RG_PREFIX_GAME, gameId), StdLib.Serialize(g));
                OnRewardGameExpired(appId, gameId, g.Player, g.Difficulty);
                return 3;
            }
            ExecutionEngine.Assert(false, "game not expirable");
            return 0;
        }
        #endregion

        #region Internal ledger helpers
        // The liability counter. External lanes (fund / entry / withdraw)
        // pass a signed delta; internal moves (entry -> pool at start,
        // pool -> credit at settle) never touch it.
        private static void AdjustRewardHeld(string appId, BigInteger delta)
        {
            byte[] key = AppKey(appId, RG_PREFIX_HELD);
            BigInteger held = (BigInteger)Storage.Get(Storage.CurrentContext, key) + delta;
            ExecutionEngine.Assert(held >= 0, "liability counter underflow");
            if (held == 0) Storage.Delete(Storage.CurrentContext, key);
            else Storage.Put(Storage.CurrentContext, key, held);
        }

        private static RewardGame LoadRewardGame(StorageContext ctx, string appId, BigInteger gameId)
        {
            ByteString raw = Storage.Get(ctx, AppKey(appId, RG_PREFIX_GAME, gameId));
            ExecutionEngine.Assert(raw is not null, "game not found");
            return (RewardGame)StdLib.Deserialize(raw);
        }

        private static RewardStats LoadRewardStats(StorageContext ctx, string appId, UInt160 player)
        {
            ByteString raw = Storage.Get(ctx, AppKey(appId, RG_PREFIX_STATS, player));
            if (raw is null) return new RewardStats { Played = 0, Solved = 0, TotalWon = 0 };
            return (RewardStats)StdLib.Deserialize(raw);
        }

        private static void AddRewardCredit(StorageContext ctx, string appId, UInt160 player, BigInteger amount)
        {
            byte[] key = AppKey(appId, RG_PREFIX_CREDIT, player);
            Storage.Put(ctx, key, (BigInteger)Storage.Get(ctx, key) + amount);
        }

        /// <summary>Delete the player's active-game pointer only if it is this game.</summary>
        private static void ClearRewardActive(StorageContext ctx, string appId, UInt160 player, BigInteger gameId)
        {
            byte[] key = AppKey(appId, RG_PREFIX_ACTIVE, player);
            ByteString current = Storage.Get(ctx, key);
            if (current is not null && (BigInteger)current == gameId) Storage.Delete(ctx, key);
        }

        private static byte[] RewardDayKey(string appId, BigInteger day, UInt160 player) =>
            (byte[])Helper.Concat(
                (ByteString)AppKey(appId, RG_PREFIX_DAY, day),
                (ByteString)(byte[])player);
        #endregion
    }
}
