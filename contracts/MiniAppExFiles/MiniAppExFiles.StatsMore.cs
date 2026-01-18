using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Stats Update Methods (Continued)

        private static void UpdateUserStatsOnUpdate(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.RecordsUpdated += 1;
            stats.TotalSpent += UPDATE_FEE;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnDelete(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.RecordsDeleted += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnReport(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.ReportsSubmitted += 1;
            stats.TotalSpent += REPORT_FEE;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);

            // Update total reports
            BigInteger totalReports = TotalReports();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REPORTS, totalReports + 1);

            CheckAllBadges(user);
        }

        private static void UpdateRecordOwnerOnVerify(UInt160 owner)
        {
            UserStats stats = GetUserStats(owner);
            stats.VerifiedRecordsOwned += 1;
            stats.ReputationScore += 15;
            StoreUserStats(owner, stats);
        }

        #endregion
    }
}
