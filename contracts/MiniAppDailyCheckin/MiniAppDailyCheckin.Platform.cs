using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
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
            stats["firstReward"] = FIRST_REWARD;
            stats["subsequentReward"] = SUBSEQUENT_REWARD;
            stats["milestone30Bonus"] = MILESTONE_30_BONUS;
            stats["milestone100Bonus"] = MILESTONE_100_BONUS;
            stats["milestone365Bonus"] = MILESTONE_365_BONUS;

            BigInteger currentDay = Runtime.Time / TWENTY_FOUR_HOURS_SECONDS;
            stats["currentUtcDay"] = currentDay;
            stats["nextMidnight"] = (currentDay + 1) * TWENTY_FOUR_HOURS_SECONDS;

            return stats;
        }

        #endregion
    }
}
