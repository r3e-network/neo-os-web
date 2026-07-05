using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppPetPotion
    {
        #region StartGame (pay entry, reserve reward, start the solve clock)
        /// <summary>
        /// Start a Sudoku challenge. Consumes the per-difficulty entry from the player's
        /// prepaid credit into the reward pool, reserves the full base reward from the
        /// free pool, sets the deadline and marks the game active. The puzzle is derived
        /// inside the TEE session service; only the finalize result (verified by the
        /// kernel) settles the game. Returns the gameId.
        /// </summary>
        public static BigInteger StartGame(UInt160 player, BigInteger difficulty)
        {
            ExecutionEngine.Assert(!IsPaused(), "contract is paused");
            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(difficulty >= 0 && difficulty <= 2, "difficulty must be 0..2");
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            byte[] activeKey = ActiveKey(player);
            ExecutionEngine.Assert(Storage.Get(ctx, activeKey) is null, "finish your active game first");

            // Per-UTC-day start cap (dayNumber = Runtime.Time / 86_400_000).
            BigInteger day = (BigInteger)Runtime.Time / MS_PER_DAY;
            byte[] dayKey = DayKey(day, player);
            BigInteger startsToday = (BigInteger)Storage.Get(ctx, dayKey);
            ExecutionEngine.Assert(startsToday < CapValue(ctx), "daily start cap reached");
            Storage.Put(ctx, dayKey, startsToday + 1);

            // The entry funds the pool.
            BigInteger entry = EntryOf(difficulty);
            byte[] creditKey = CreditKey(player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= entry, "insufficient entry credit — deposit first");
            BigInteger nextCredit = credit - entry;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + entry;
            Storage.Put(ctx, PREFIX_POOL, pool);

            // Reserve the full base reward so this game stays payable.
            BigInteger reward = RewardOf(difficulty);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            ExecutionEngine.Assert(pool - reserved >= reward, "reward pool cannot cover this game");
            Storage.Put(ctx, PREFIX_RESERVED, reserved + reward);

            BigInteger gameId = (BigInteger)Storage.Get(ctx, PREFIX_GAME_ID) + 1;
            Storage.Put(ctx, PREFIX_GAME_ID, gameId);

            BigInteger now = Runtime.Time;
            Game g = new Game
            {
                Player = player,
                Difficulty = difficulty,
                Entry = entry,
                Reward = reward,
                StartTime = now,
                Commitment = "",
                DealtAt = now,
                Deadline = now + LimitMsOf(difficulty),
                Undos = 0,
                Status = 1,
                Payout = 0,
                SolveMs = 0,
                AnswerHash = "",
                Score = 0,
            };
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
            Storage.Put(ctx, activeKey, gameId);

            Stats s = LoadStats(ctx, player);
            s.Played += 1;
            Storage.Put(ctx, StatsKey(player), StdLib.Serialize(s));

            OnGameStarted(gameId, player, difficulty, entry, now);
            return gameId;
        }
        #endregion

        #region ExpireGame (release reservation for a game that can no longer settle) — PERMISSIONLESS
        /// <summary>
        /// Close a game that can no longer settle. An active (Status 1) or abandoned
        /// settling (Status 5) game past its deadline and settlement grace window has
        /// its reward reservation released (Status 3). Returns the new status.
        /// </summary>
        public static BigInteger ExpireGame(BigInteger gameId)
        {
            StorageContext ctx = Storage.CurrentContext;
            Game g = LoadGame(ctx, gameId);
            BigInteger now = Runtime.Time;

            if ((g.Status == 1 || g.Status == 5) && now > g.Deadline + SETTLE_GRACE_MS)
            {
                Storage.Put(ctx, PREFIX_RESERVED, (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - g.Reward);
                ClearActive(ctx, g.Player, gameId);
                g.Status = 3;
                Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
                OnGameExpired(gameId, g.Player, g.Difficulty);
                return 3;
            }
            ExecutionEngine.Assert(false, "game not expirable");
            return 0;
        }
        #endregion

        #region Withdraw credit (pull payment)
        /// <summary>Reclaim the whole credit balance (unused entries + won payouts).</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = CreditKey(account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            // Effects before interaction.
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Internal helpers
        private static Game LoadGame(StorageContext ctx, BigInteger gameId)
        {
            ByteString raw = Storage.Get(ctx, GameKey(gameId));
            ExecutionEngine.Assert(raw is not null, "game not found");
            return (Game)StdLib.Deserialize(raw);
        }

        private static Stats LoadStats(StorageContext ctx, UInt160 player)
        {
            ByteString raw = Storage.Get(ctx, StatsKey(player));
            if (raw is null) return new Stats { Played = 0, Solved = 0, TotalWon = 0 };
            return (Stats)StdLib.Deserialize(raw);
        }

        private static void AddCredit(StorageContext ctx, UInt160 player, BigInteger amount)
        {
            byte[] key = CreditKey(player);
            Storage.Put(ctx, key, (BigInteger)Storage.Get(ctx, key) + amount);
        }

        /// <summary>Delete the player's active-game pointer only if it is this game.</summary>
        private static void ClearActive(StorageContext ctx, UInt160 player, BigInteger gameId)
        {
            byte[] key = ActiveKey(player);
            ByteString cur = Storage.Get(ctx, key);
            if (cur is not null && (BigInteger)cur == gameId) Storage.Delete(ctx, key);
        }

        private static BigInteger CapValue(StorageContext ctx)
        {
            BigInteger cap = (BigInteger)Storage.Get(ctx, PREFIX_DAILY_CAP);
            return cap == 0 ? DEFAULT_DAILY_CAP : cap;
        }

        private static byte[] GameKey(BigInteger id) => Helper.Concat(PREFIX_GAME, (byte[])(ByteString)id);
        private static byte[] ActiveKey(UInt160 player) => Helper.Concat(PREFIX_ACTIVE, (byte[])player);
        private static byte[] CreditKey(UInt160 player) => Helper.Concat(PREFIX_CREDIT, (byte[])player);
        private static byte[] StatsKey(UInt160 player) => Helper.Concat(PREFIX_STATS, (byte[])player);
        private static byte[] DayKey(BigInteger day, UInt160 player) =>
            Helper.Concat(Helper.Concat(PREFIX_DAY, (byte[])(ByteString)day), (byte[])player);
        #endregion
    }
}
