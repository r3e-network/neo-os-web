using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Badge Logic

        private static void CheckUserBadges(UInt160 user, UserStats stats)
        {
            if (stats.EnvelopesCreated >= 1)
            {
                AwardBadge(user, 1, "First Envelope");
            }

            if (stats.EnvelopesCreated >= 10)
            {
                AwardBadge(user, 2, "Generous");
            }

            if (stats.BestLuckWins >= 5)
            {
                AwardBadge(user, 3, "Lucky One");
            }

            if (stats.EnvelopesClaimed >= 50)
            {
                AwardBadge(user, 4, "Collector");
            }

            if (stats.TotalSent >= 10000000000)
            {
                AwardBadge(user, 5, "Big Spender");
            }

            if (stats.EnvelopesCreated >= 50)
            {
                AwardBadge(user, 6, "Social Butterfly");
            }
        }

        #endregion
    }
}
