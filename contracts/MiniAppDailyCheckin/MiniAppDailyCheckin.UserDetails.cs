using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region User Stats Details

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            Map<string, object> details = new Map<string, object>();

            details["streak"] = GetUserStreak(user);
            details["highestStreak"] = GetUserHighestStreak(user);
            details["lastCheckinDay"] = GetUserLastCheckin(user);
            details["unclaimed"] = GetUserUnclaimed(user);
            details["claimed"] = GetUserClaimed(user);
            details["totalCheckins"] = GetUserCheckins(user);
            details["resets"] = GetUserResets(user);
            details["joinTime"] = GetUserJoinTime(user);
            details["badgeCount"] = GetUserBadgeCount(user);

            BigInteger lastDay = GetUserLastCheckin(user);
            if (lastDay > 0)
            {
                details["nextEligible"] = (lastDay + 1) * TWENTY_FOUR_HOURS_SECONDS;
            }

            details["hasFirstCheckin"] = HasBadge(user, 1);
            details["hasWeekWarrior"] = HasBadge(user, 2);
            details["hasMonthMaster"] = HasBadge(user, 3);
            details["hasCenturion"] = HasBadge(user, 4);
            details["hasYearLegend"] = HasBadge(user, 5);
            details["hasComeback"] = HasBadge(user, 6);

            return details;
        }

        #endregion
    }
}
