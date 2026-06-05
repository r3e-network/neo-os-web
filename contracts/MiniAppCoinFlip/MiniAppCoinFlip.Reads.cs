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
    public partial class MiniAppCoinFlip : SmartContract
    {
        #region Read-only
        [Safe]
        public static BigInteger Bankroll() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BANKROLL);

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));

        [Safe]
        public static BigInteger LastGameId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GAME_ID);

        [Safe]
        public static Map<string, object> GetStats(UInt160 player)
        {
            Stats s = LoadStats(Storage.CurrentContext, player);
            Map<string, object> r = new Map<string, object>();
            r["wins"] = s.Wins; r["losses"] = s.Losses; r["totalWon"] = s.TotalWon;
            return r;
        }

        [Safe]
        public static Map<string, object> GetGame(BigInteger gameId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, GameKey(gameId));
            ExecutionEngine.Assert(raw is not null, "game not found");
            Game g = (Game)StdLib.Deserialize(raw);
            Map<string, object> r = new Map<string, object>();
            r["id"] = gameId; r["player"] = g.Player; r["choice"] = g.Choice; r["outcome"] = g.Outcome;
            r["won"] = g.Won; r["wager"] = g.Wager; r["payout"] = g.Payout; r["time"] = g.Time;
            return r;
        }

        [Safe]
        public static BigInteger PlayerGameCount(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));

        [Safe]
        public static BigInteger[] GetPlayerGames(UInt160 player, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player));
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > n) end = n;
            if (start > end) return new BigInteger[0];
            BigInteger count = end - start + 1;
            BigInteger[] result = new BigInteger[(int)count];
            BigInteger idx = 0;
            for (BigInteger i = start; i <= end; i++)
            {
                result[(int)idx] = (BigInteger)Storage.Get(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)i));
                idx += 1;
            }
            return result;
        }
        #endregion

        #region Internal
        private static Stats LoadStats(StorageContext ctx, UInt160 player)
        {
            ByteString raw = Storage.Get(ctx, StatsKey(player));
            if (raw is null) return new Stats { Wins = 0, Losses = 0, TotalWon = 0 };
            return (Stats)StdLib.Deserialize(raw);
        }
        private static byte[] StatsKey(UInt160 player) => Helper.Concat(PREFIX_STATS, (byte[])player);
        private static byte[] GameKey(BigInteger id) => Helper.Concat(PREFIX_GAME, (byte[])(ByteString)id);
        private static void IndexAppend(StorageContext ctx, UInt160 player, BigInteger gameId)
        {
            byte[] cntKey = Helper.Concat(PREFIX_PLAYER_CNT, (byte[])player);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            Storage.Put(ctx, Helper.Concat(Helper.Concat(PREFIX_PLAYER_ITEM, (byte[])player), (byte[])(ByteString)n), gameId);
        }
        #endregion
    }
}
