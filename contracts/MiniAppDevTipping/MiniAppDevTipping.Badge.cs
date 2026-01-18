using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Badge Logic

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
