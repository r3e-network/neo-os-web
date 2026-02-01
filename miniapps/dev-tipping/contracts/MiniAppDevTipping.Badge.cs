using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Badge Logic

        /// <summary>
        /// Check and award tipper badges based on achievements.
        /// 
        /// BADGE CRITERIA:
        /// - Type 1 "First Tip": First tip sent
        /// - Type 2 "Supporter": 10 tips sent
        /// - Type 3 "Patron": 100 tips sent
        /// - Type 4 "Benefactor": 1000 GAS total tipped
        /// </summary>
        /// <param name="tipper">Tipper address</param>
        private static void CheckTipperBadges(UInt160 tipper)
        {
            TipperStats stats = GetTipperStats(tipper);

            if (stats.TipCount == 1)
                AwardTipperBadge(tipper, 1, "First Tip");

            if (stats.TipCount >= 10)
                AwardTipperBadge(tipper, 2, "Supporter");

            if (stats.TipCount >= 100)
                AwardTipperBadge(tipper, 3, "Patron");

            if (stats.TotalTipped >= 100000000000)
                AwardTipperBadge(tipper, 4, "Benefactor");
        }

        /// <summary>
        /// Check and award developer badges based on total received.
        /// 
        /// BADGE CRITERIA:
        /// - Type 1 "Rising Star": 1 GAS received (Milestone 1)
        /// - Type 2 "Popular": 10 GAS received (Milestone 2)
        /// - Type 3 "Legend": 100 GAS received (Milestone 3)
        /// </summary>
        /// <param name="devId">Developer ID</param>
        private static void CheckDevBadges(BigInteger devId)
        {
            DeveloperData dev = GetDeveloper(devId);

            if (dev.TotalReceived >= MILESTONE_1)
                AwardDevBadge(devId, 1, "Rising Star");

            if (dev.TotalReceived >= MILESTONE_2)
                AwardDevBadge(devId, 2, "Popular");

            if (dev.TotalReceived >= MILESTONE_3)
                AwardDevBadge(devId, 3, "Legend");
        }

        #endregion
    }
}
