using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Achievement Methods

        private static void CheckClaimAchievements(UInt160 user)
        {
            UserStats stats = GetUserStats(user);

            if (stats.PiecesClaimed == 1)
            {
                CheckAndAwardBadge(user, 1, "First Piece");
            }

            if (stats.PiecesOwned >= 10)
            {
                CheckAndAwardBadge(user, 2, "Collector 10");
            }

            if (stats.PiecesOwned >= 100)
            {
                CheckAndAwardBadge(user, 3, "Collector 100");
            }
        }

        private static void CheckTraderAchievement(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            if (stats.PiecesBought >= 5)
            {
                CheckAndAwardBadge(user, 5, "Trader");
            }
        }

        private static void CheckAndAwardBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            UserStats stats = GetUserStats(user);
            stats.BadgeCount += 1;
            StoreUserStats(user, stats);

            OnAchievementUnlocked(user, badgeType, badgeName);
        }

        #endregion
    }
}
