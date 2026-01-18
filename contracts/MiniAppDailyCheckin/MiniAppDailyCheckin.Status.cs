using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Checkin Status

        [Safe]
        public static Map<string, object> GetCheckinStatus(UInt160 user)
        {
            Map<string, object> status = new Map<string, object>();

            BigInteger currentDay = Runtime.Time / TWENTY_FOUR_HOURS_SECONDS;
            BigInteger lastCheckinDay = GetUserLastCheckin(user);

            status["currentUtcDay"] = currentDay;
            status["lastCheckinDay"] = lastCheckinDay;
            status["canCheckin"] = lastCheckinDay == 0 || currentDay > lastCheckinDay;

            if (lastCheckinDay > 0 && currentDay <= lastCheckinDay)
            {
                BigInteger nextEligible = (lastCheckinDay + 1) * TWENTY_FOUR_HOURS_SECONDS;
                status["timeUntilEligible"] = nextEligible - (BigInteger)Runtime.Time;
            }
            else
            {
                status["timeUntilEligible"] = 0;
            }

            if (lastCheckinDay > 0 && currentDay > lastCheckinDay + 1)
            {
                status["streakWillReset"] = true;
            }
            else
            {
                status["streakWillReset"] = false;
            }

            status["currentStreak"] = GetUserStreak(user);
            status["nextRewardDay"] = CalculateNextRewardDay(GetUserStreak(user));

            return status;
        }

        #endregion
    }
}
