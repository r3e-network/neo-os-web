using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Platform Stats

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalUsers"] = TotalUsers();
            stats["totalCheckins"] = TotalCheckins();
            stats["totalRewarded"] = TotalRewarded();
            stats["checkInFee"] = CHECK_IN_FEE;
            stats["weekReward"] = FIRST_REWARD;
            stats["twoWeekReward"] = SUBSEQUENT_REWARD;
            stats["resetAfterDays"] = STREAK_RESET_DAYS;

            BigInteger currentDay = Runtime.Time / TWENTY_FOUR_HOURS_SECONDS;
            stats["currentUtcDay"] = currentDay;
            stats["nextMidnight"] = (currentDay + 1) * TWENTY_FOUR_HOURS_SECONDS;

            return stats;
        }

        #endregion
    }
}
