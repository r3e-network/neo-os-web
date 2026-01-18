using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGraveyard
    {
        #region Badge Logic

        /// <summary>
        /// Check and award user badges based on achievements.
        /// Badges: 1=FirstMemory, 2=MemoryKeeper(5), 3=LettingGo(3 forgotten),
        ///         4=MemorialBuilder, 5=Generous(5 GAS), 6=Veteran(10)
        /// </summary>
        private static void CheckUserBadges(UInt160 user)
        {
            UserStats stats = GetUserStatsData(user);

            if (stats.MemoriesBuried >= 1)
                AwardUserBadge(user, 1, "First Memory");

            if (stats.MemoriesBuried >= 5)
                AwardUserBadge(user, 2, "Memory Keeper");

            if (stats.MemoriesForgotten >= 3)
                AwardUserBadge(user, 3, "Letting Go");

            if (stats.MemorialsCreated >= 1)
                AwardUserBadge(user, 4, "Memorial Builder");

            if (stats.TributesSent >= 500000000) // 5 GAS
                AwardUserBadge(user, 5, "Generous");

            if (stats.MemoriesBuried >= 10)
                AwardUserBadge(user, 6, "Veteran");
        }

        private static void AwardUserBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasUserBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            UserStats stats = GetUserStatsData(user);
            stats.BadgeCount += 1;
            StoreUserStats(user, stats);

            OnUserBadgeEarned(user, badgeType, badgeName);
        }

        #endregion
    }
}
