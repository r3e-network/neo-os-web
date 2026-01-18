using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Global Stats Getters

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static BigInteger TotalCheckins() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS);

        [Safe]
        public static BigInteger TotalRewarded() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REWARDED);

        [Safe]
        public static bool HasBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static BigInteger GetUserResets(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_RESETS, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        #endregion
    }
}
