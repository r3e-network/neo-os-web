using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region User Stats Query

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["recordsCreated"] = stats.RecordsCreated;
            details["recordsVerified"] = stats.RecordsVerified;
            details["queriesMade"] = stats.QueriesMade;
            details["totalSpent"] = stats.TotalSpent;
            details["reputationScore"] = stats.ReputationScore;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["reportsSubmitted"] = stats.ReportsSubmitted;
            details["recordsDeleted"] = stats.RecordsDeleted;
            details["recordsUpdated"] = stats.RecordsUpdated;
            details["highestRating"] = stats.HighestRating;
            details["verifiedRecordsOwned"] = stats.VerifiedRecordsOwned;
            details["recordCount"] = GetUserRecordCount(user);

            // Badge status
            details["hasFirstRecord"] = HasBadge(user, 1);
            details["hasVerifier"] = HasBadge(user, 2);
            details["hasTopContributor"] = HasBadge(user, 3);
            details["hasTruthSeeker"] = HasBadge(user, 4);
            details["hasReporter"] = HasBadge(user, 5);
            details["hasVeteran"] = HasBadge(user, 6);

            return details;
        }

        #endregion
    }
}
