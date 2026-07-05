using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppJumpRush
    {
        #region StartGame
        public static BigInteger StartGame(UInt160 player, BigInteger difficulty)
        {
            ExecutionEngine.Assert(!IsPaused(), "contract is paused");
            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(Storage.Get(ctx, PREFIX_TEE_PUB) is not null, "tee signer not configured");
            ExecutionEngine.Assert(difficulty >= 0 && difficulty <= 2, "difficulty must be 0..2");
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            byte[] activeKey = ActiveKey(player);
            ExecutionEngine.Assert(Storage.Get(ctx, activeKey) is null, "finish your active game first");

            BigInteger day = (BigInteger)Runtime.Time / MS_PER_DAY;
            byte[] dayKey = DayKey(day, player);
            BigInteger startsToday = (BigInteger)Storage.Get(ctx, dayKey);
            ExecutionEngine.Assert(startsToday < CapValue(ctx), "daily start cap reached");
            Storage.Put(ctx, dayKey, startsToday + 1);

            BigInteger entry = EntryOf(difficulty);
            byte[] creditKey = CreditKey(player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= entry, "insufficient entry credit — deposit first");
            BigInteger nextCredit = credit - entry;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + entry;
            Storage.Put(ctx, PREFIX_POOL, pool);

            BigInteger reward = RewardOf(difficulty);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            ExecutionEngine.Assert(pool - reserved >= reward, "reward pool cannot cover this game");
            Storage.Put(ctx, PREFIX_RESERVED, reserved + reward);

            BigInteger gameId = (BigInteger)Storage.Get(ctx, PREFIX_GAME_ID) + 1;
            Storage.Put(ctx, PREFIX_GAME_ID, gameId);

            Game g = new Game
            {
                Player = player,
                Difficulty = difficulty,
                Entry = entry,
                Reward = reward,
                StartTime = Runtime.Time,
                Commitment = "",
                DealtAt = 0,
                Deadline = 0,
                Undos = 0,
                Status = 0,
                Payout = 0,
                SolveMs = 0,
                AnswerHash = "",
            };
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
            Storage.Put(ctx, activeKey, gameId);

            Stats s = LoadStats(ctx, player);
            s.Played += 1;
            Storage.Put(ctx, StatsKey(player), StdLib.Serialize(s));

            OnGameStarted(gameId, player, difficulty, entry, Runtime.Time);
            return gameId;
        }
        #endregion

        #region ExpireGame
        public static BigInteger ExpireGame(BigInteger gameId)
        {
            StorageContext ctx = Storage.CurrentContext;
            Game g = LoadGame(ctx, gameId);
            BigInteger now = Runtime.Time;

            if (g.Status == 1 && now > g.Deadline + SETTLE_GRACE_MS)
            {
                Storage.Put(ctx, PREFIX_RESERVED, (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - g.Reward);
                ClearActive(ctx, g.Player, gameId);
                g.Status = 3;
                Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
                OnGameExpired(gameId, g.Player, g.Difficulty);
                return 3;
            }
            if (g.Status == 0 && now > g.StartTime + DEAL_TTL_MS)
            {
                Storage.Put(ctx, PREFIX_RESERVED, (BigInteger)Storage.Get(ctx, PREFIX_RESERVED) - g.Reward);
                Storage.Put(ctx, PREFIX_POOL, (BigInteger)Storage.Get(ctx, PREFIX_POOL) - g.Entry);
                AddCredit(ctx, g.Player, g.Entry);
                ClearActive(ctx, g.Player, gameId);
                g.Status = 4;
                Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
                OnGameRefunded(gameId, g.Player, g.Entry);
                return 4;
            }
            ExecutionEngine.Assert(false, "game not expirable");
            return 0;
        }
        #endregion

        #region Withdraw
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = CreditKey(account);
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