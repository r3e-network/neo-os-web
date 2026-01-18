using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Award Badge

        private static void AwardBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            IncrementUserBadgeCount(user);
            OnBadgeEarned(user, badgeType, badgeName);
        }

        private static void IncrementUserBadgeCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BADGE_COUNT, user);
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, current + 1);
        }

        [Safe]
        public static BigInteger GetUserBadgeCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BADGE_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        #endregion
    }
}
