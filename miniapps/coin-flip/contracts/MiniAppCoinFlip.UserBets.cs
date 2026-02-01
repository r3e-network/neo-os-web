using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region User Bets Query

        /// <summary>Get total number of bets placed by a player.</summary>
        /// <param name="player">Player address</param>
        /// <returns>Number of bets</returns>
        [Safe]
        public static BigInteger GetUserBetCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BET_COUNT, player);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Get paginated list of bet IDs for a player.
        /// 
        /// PAGINATION:
        /// - offset: Starting index (0-based)
        /// - limit: Maximum items to return
        /// </summary>
        /// <param name="player">Player address</param>
        /// <param name="offset">Starting index</param>
        /// <param name="limit">Maximum items</param>
        /// <returns>Array of bet IDs</returns>
        [Safe]
        public static BigInteger[] GetUserBets(UInt160 player, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserBetCount(player);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_BETS, player),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        #endregion
    }
}
