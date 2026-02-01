using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetTipperStatsDetails(UInt160 tipper)
        {
            TipperStats stats = GetTipperStats(tipper);
            Map<string, object> details = new Map<string, object>();

            details["totalTipped"] = stats.TotalTipped;
            details["tipCount"] = stats.TipCount;
            details["devsSupported"] = stats.DevsSupported;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastTipTime"] = stats.LastTipTime;
            details["highestTip"] = stats.HighestTip;
            details["favoriteDevId"] = stats.FavoriteDevId;

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalDevelopers"] = TotalDevelopers();
            stats["activeDevelopers"] = ActiveDevelopers();
            stats["totalDonated"] = TotalDonated();
            stats["totalTips"] = TotalTips();
            stats["minTip"] = MIN_TIP;
            stats["bronzeTier"] = BRONZE_TIP;
            stats["silverTier"] = SILVER_TIP;
            stats["goldTier"] = GOLD_TIP;
            return stats;
        }

        #endregion
    }
}
