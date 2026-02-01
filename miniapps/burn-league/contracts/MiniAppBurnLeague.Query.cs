using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetUserStats(UInt160 user)
        {
            Map<string, object> stats = new Map<string, object>();
            BurnerStats burnerStats = GetBurnerStats(user);

            stats["totalBurned"] = burnerStats.TotalBurned;
            stats["totalPoints"] = burnerStats.TotalPoints;
            stats["seasonsParticipated"] = burnerStats.SeasonsParticipated;
            stats["totalRewardsClaimed"] = burnerStats.TotalRewardsClaimed;
            stats["highestSingleBurn"] = burnerStats.HighestSingleBurn;
            stats["burnCount"] = burnerStats.BurnCount;
            stats["badgeCount"] = burnerStats.BadgeCount;
            stats["joinTime"] = burnerStats.JoinTime;
            stats["lastActivityTime"] = burnerStats.LastActivityTime;
            stats["tier3Burns"] = burnerStats.Tier3Burns;

            UserStreak streak = GetUserStreak(user);
            stats["currentStreak"] = streak.CurrentStreak;
            stats["longestStreak"] = streak.LongestStreak;
            stats["lastBurnTime"] = streak.LastBurnTime;

            BigInteger seasonId = CurrentSeasonId();
            if (seasonId > 0)
            {
                stats["seasonPoints"] = GetUserSeasonPoints(user, seasonId);
            }

            // Badge status
            stats["hasFirstBurn"] = HasBurnerBadge(user, 1);
            stats["hasActiveBurner"] = HasBurnerBadge(user, 2);
            stats["hasWhaleBurner"] = HasBurnerBadge(user, 3);
            stats["hasStreakMaster"] = HasBurnerBadge(user, 4);
            stats["hasSeasonVeteran"] = HasBurnerBadge(user, 5);
            stats["hasTier3Elite"] = HasBurnerBadge(user, 6);

            return stats;
        }

        #endregion
    }
}
