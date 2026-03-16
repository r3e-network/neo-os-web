using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Milestone Logic

        private static void CheckMilestones(UInt160 user, BigInteger streak)
        {
            if (streak == 7 || streak == STREAK_RESET_DAYS)
            {
                OnMilestoneReached(user, streak, streak);
            }
        }

        #endregion
    }
}
