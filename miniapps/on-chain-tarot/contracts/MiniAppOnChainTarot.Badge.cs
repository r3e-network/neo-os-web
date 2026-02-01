using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppOnChainTarot
    {
        #region Badge Logic

        /// <summary>
        /// Check and award user badges based on achievements.
        /// Badges: 1=FirstReading, 2=Seeker(10 readings), 3=Mystic(50 readings),
        ///         4=CelticMaster(10 Celtic Cross), 5=BigSpender(10 GAS), 6=Rater(10 ratings)
        /// </summary>
        private static void CheckUserBadges(UInt160 user)
        {
            UserStats stats = GetUserStats(user);

            if (stats.TotalReadings >= 1)
                AwardUserBadge(user, 1, "First Reading");

            if (stats.TotalReadings >= 10)
                AwardUserBadge(user, 2, "Seeker");

            if (stats.TotalReadings >= 50)
                AwardUserBadge(user, 3, "Mystic");

            if (stats.CelticCrossCount >= 10)
                AwardUserBadge(user, 4, "Celtic Master");

            if (stats.TotalSpent >= 1000000000) // 10 GAS
                AwardUserBadge(user, 5, "Big Spender");

            if (stats.RatingsGiven >= 10)
                AwardUserBadge(user, 6, "Rater");
        }

        private static void AwardUserBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasUserBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            UserStats stats = GetUserStats(user);
            stats.BadgeCount += 1;
            StoreUserStats(user, stats);

        }

        #endregion
    }
}
