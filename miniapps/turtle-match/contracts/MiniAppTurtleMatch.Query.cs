using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTurtleMatch
    {
        #region Player Queries
        [Safe]
        public static BigInteger GetPlayerSessionCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_SESSION_COUNT, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static GameSession[] GetPlayerSessions(UInt160 player, BigInteger limit)
        {
            BigInteger count = GetPlayerSessionCount(player);
            if (count == 0) return new GameSession[0];

            if (limit > count) limit = count;
            if (limit > 20) limit = 20;

            GameSession[] sessions = new GameSession[(int)limit];
            BigInteger start = count - limit;

            for (int i = 0; i < (int)limit; i++)
            {
                byte[] indexKey = Helper.Concat(
                    Helper.Concat(PREFIX_PLAYER_SESSIONS, (ByteString)player),
                    (ByteString)(start + i).ToByteArray());
                BigInteger sessionId = (BigInteger)Storage.Get(Storage.CurrentContext, indexKey);
                sessions[i] = GetSession(sessionId);
            }

            return sessions;
        }

        [Safe]
        public static GameSession GetPlayerActiveSession(UInt160 player)
        {
            BigInteger count = GetPlayerSessionCount(player);
            if (count == 0) return new GameSession();

            byte[] indexKey = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_SESSIONS, (ByteString)player),
                (ByteString)(count - 1).ToByteArray());
            BigInteger sessionId = (BigInteger)Storage.Get(Storage.CurrentContext, indexKey);
            GameSession session = GetSession(sessionId);

            // Return unsettled session only
            if (session.Settled) return new GameSession();
            return session;
        }
        #endregion

        #region Platform Stats
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalSessions"] = GetTotalSessions();
            stats["totalBoxes"] = GetTotalBoxes();
            stats["totalMatches"] = GetTotalMatches();
            stats["totalPaid"] = GetTotalPaid();
            stats["blindboxPrice"] = BLINDBOX_PRICE;
            stats["gridSize"] = GRID_SIZE;
            stats["colorCount"] = COLOR_COUNT;
            return stats;
        }
        #endregion
    }
}
