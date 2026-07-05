using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppJumpRush
    {
        private const string HEX_DIGITS = "0123456789abcdef";

        [Safe]
        public static BigInteger PoolBalance() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        [Safe]
        public static BigInteger ReservedPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RESERVED);

        [Safe]
        public static BigInteger FreePool()
        {
            StorageContext ctx = Storage.CurrentContext;
            return (BigInteger)Storage.Get(ctx, PREFIX_POOL) - (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
        }

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, CreditKey(player));

        [Safe]
        public static BigInteger LastGameId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GAME_ID);

        [Safe]
        public static BigInteger ActiveGameOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, ActiveKey(player));

        [Safe]
        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != 0;

        [Safe]
        public static BigInteger DailyCap() => CapValue(Storage.CurrentContext);

        [Safe]
        public static BigInteger DailyStartsOf(UInt160 player)
        {
            BigInteger day = (BigInteger)Runtime.Time / MS_PER_DAY;
            return (BigInteger)Storage.Get(Storage.CurrentContext, DayKey(day, player));
        }

        [Safe]
        public static ECPoint TeeSigner()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TEE_PUB);
            return raw is null ? null : (ECPoint)(byte[])raw;
        }

        [Safe]
        public static BigInteger NetworkMagic() => (BigInteger)Runtime.GetNetwork();

        [Safe]
        public static Map<string, object> StatsOf(UInt160 player)
        {
            Stats s = LoadStats(Storage.CurrentContext, player);
            Map<string, object> r = new Map<string, object>();
            r["played"] = s.Played;
            r["solved"] = s.Solved;
            r["totalWon"] = s.TotalWon;
            return r;
        }

        [Safe]
        public static Map<string, object> TopPlayer()
        {
            StorageContext ctx = Storage.CurrentContext;
            ByteString addr = Storage.Get(ctx, PREFIX_TOP_ADDR);
            Map<string, object> r = new Map<string, object>();
            if (addr is null) r["player"] = ""; else r["player"] = addr;
            r["totalWon"] = (BigInteger)Storage.Get(ctx, PREFIX_TOP_WON);
            return r;
        }

        [Safe]
        public static Map<string, object> GetGame(BigInteger gameId)
        {
            Game g = LoadGame(Storage.CurrentContext, gameId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = gameId;
            r["player"] = g.Player;
            r["difficulty"] = g.Difficulty;
            r["entry"] = g.Entry;
            r["reward"] = g.Reward;
            r["startTime"] = g.StartTime;
            r["commitment"] = ToHex(g.Commitment);
            r["dealtAt"] = g.DealtAt;
            r["deadline"] = g.Deadline;
            r["undos"] = g.Undos;
            r["status"] = g.Status;
            r["payout"] = g.Payout;
            r["solveMs"] = g.SolveMs;
            r["answerHash"] = ToHex(g.AnswerHash);
            return r;
        }

        [Safe]
        public static Map<string, object> GetConfig()
        {
            Map<string, object> r = new Map<string, object>();
            r["entry0"] = EntryOf(0);
            r["entry1"] = EntryOf(1);
            r["entry2"] = EntryOf(2);
            r["reward0"] = RewardOf(0);
            r["reward1"] = RewardOf(1);
            r["reward2"] = RewardOf(2);
            r["limitMs0"] = LimitMsOf(0);
            r["limitMs1"] = LimitMsOf(1);
            r["limitMs2"] = LimitMsOf(2);
            r["minSolveMs0"] = MinSolveMsOf(0);
            r["minSolveMs1"] = MinSolveMsOf(1);
            r["minSolveMs2"] = MinSolveMsOf(2);
            r["targetJumps0"] = TargetJumpsOf(0);
            r["targetJumps1"] = TargetJumpsOf(1);
            r["targetJumps2"] = TargetJumpsOf(2);
            r["maxUndos"] = (BigInteger)MAX_UNDOS;
            r["undoPenaltyPct"] = (BigInteger)UNDO_PENALTY_PCT;
            r["dailyCap"] = CapValue(Storage.CurrentContext);
            r["settleGraceMs"] = (BigInteger)SETTLE_GRACE_MS;
            return r;
        }

        private static string ToHex(ByteString value)
        {
            byte[] v = (byte[])value;
            byte[] hex = (byte[])(ByteString)HEX_DIGITS;
            byte[] outChars = new byte[v.Length * 2];
            for (int i = 0; i < v.Length; i++)
            {
                int b = v[i] & 0xFF;
                outChars[i * 2] = hex[b >> 4];
                outChars[i * 2 + 1] = hex[b & 0x0F];
            }
            return (string)(ByteString)outChars;
        }
    }
}