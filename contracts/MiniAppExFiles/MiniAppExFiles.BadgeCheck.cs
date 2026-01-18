using System.Numerics;
using Neo;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Badge Check Logic

        /// <summary>
        /// Check and award user badges based on achievements.
        /// </summary>
        private static void CheckAllBadges(UInt160 user)
        {
            UserStats stats = GetUserStats(user);

            // Badge 1: First Record
            if (stats.RecordsCreated >= 1)
            {
                CheckAndAwardBadge(user, 1, "First Record");
            }

            // Badge 2: Verifier (10+ records verified)
            if (stats.RecordsVerified >= 10)
            {
                CheckAndAwardBadge(user, 2, "Verifier");
            }

            // Badge 3: Top Contributor (10+ records created)
            if (stats.RecordsCreated >= 10)
            {
                CheckAndAwardBadge(user, 3, "Top Contributor");
            }

            // Badge 4: Truth Seeker (50+ queries made)
            if (stats.QueriesMade >= 50)
            {
                CheckAndAwardBadge(user, 4, "Truth Seeker");
            }

            // Badge 5: Reporter (5+ reports submitted)
            if (stats.ReportsSubmitted >= 5)
            {
                CheckAndAwardBadge(user, 5, "Reporter");
            }

            // Badge 6: Veteran (100+ reputation score)
            if (stats.ReputationScore >= 100)
            {
                CheckAndAwardBadge(user, 6, "Veteran");
            }
        }

        #endregion
    }
}
