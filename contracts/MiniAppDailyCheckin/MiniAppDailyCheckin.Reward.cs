using System.Numerics;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Reward Calculation

        private static BigInteger CalculateReward(BigInteger streak)
        {
            if (streak < 7) return 0;
            if (streak == 7) return FIRST_REWARD;
            if (streak % 7 == 0) return SUBSEQUENT_REWARD;
            return 0;
        }

        #endregion
    }
}
