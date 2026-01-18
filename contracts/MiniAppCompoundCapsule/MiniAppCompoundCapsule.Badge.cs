using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region Badge Logic

        /// <summary>
        /// Check and award user badges based on achievements.
        /// Badges: 1=FirstCapsule, 2=LongTermSaver(90 days), 3=DiamondHands(365 days),
        ///         4=WhaleDepositor(100 NEO), 5=CompoundMaster(10 capsules), 6=LoyalSaver(no early withdrawals)
        /// </summary>
        private static void CheckUserBadges(UInt160 user)
        {
            UserStats stats = GetUserStatsData(user);

            // Badge 1: First Capsule
            if (stats.TotalCapsules >= 1)
            {
                AwardUserBadge(user, 1, "First Capsule");
            }

            // Badge 2: Long Term Saver (90+ day lock)
            if (stats.LongestLock >= 90)
            {
                AwardUserBadge(user, 2, "Long Term Saver");
            }

            // Badge 3: Diamond Hands (365+ day lock)
            if (stats.LongestLock >= 365)
            {
                AwardUserBadge(user, 3, "Diamond Hands");
            }

            // Badge 4: Whale Depositor (100+ NEO total deposited)
            if (stats.TotalDeposited >= 10000000000) // 100 NEO
            {
                AwardUserBadge(user, 4, "Whale Depositor");
            }

            // Badge 5: Compound Master (10+ capsules created)
            if (stats.TotalCapsules >= 10)
            {
                AwardUserBadge(user, 5, "Compound Master");
            }

            // Badge 6: Loyal Saver (5+ capsules with no early withdrawals)
            if (stats.TotalCapsules >= 5 && stats.TotalPenalties == 0)
            {
                AwardUserBadge(user, 6, "Loyal Saver");
            }
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
