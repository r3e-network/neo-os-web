using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Milestone Logic

        private static void CheckMilestones(UInt160 user, BigInteger streak)
        {
            BigInteger bonus = 0;

            if (streak == 30)
            {
                bonus = MILESTONE_30_BONUS;
                OnMilestoneReached(user, 30, streak);
            }
            else if (streak == 100)
            {
                bonus = MILESTONE_100_BONUS;
                OnMilestoneReached(user, 100, streak);
            }
            else if (streak == 365)
            {
                bonus = MILESTONE_365_BONUS;
                OnMilestoneReached(user, 365, streak);
            }

            if (bonus > 0)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + bonus);
                OnBonusReward(user, bonus, "milestone");
            }
        }

        #endregion
    }
}
