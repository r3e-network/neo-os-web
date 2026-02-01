using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBreakupContract
    {
        #region Query Methods

        /// <summary>
        /// Get user's contract IDs (paginated).
        /// </summary>
        [Safe]
        public static BigInteger[] GetUserContracts(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserContractCount(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_CONTRACTS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        /// <summary>
        /// Get platform statistics.
        /// </summary>
        [Safe]
        public static Map<string, object> GetStatistics()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalContracts"] = TotalContracts();
            stats["totalStaked"] = TotalStaked();
            stats["totalCompleted"] = TotalCompleted();
            stats["totalBroken"] = TotalBroken();
            stats["rewardPool"] = RewardPool();
            stats["successRate"] = TotalContracts() > 0
                ? TotalCompleted() * 100 / TotalContracts()
                : 0;
            return stats;
        }

        #endregion
    }
}
