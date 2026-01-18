using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Platform Stats

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalRecords"] = TotalRecords();
            stats["totalQueries"] = TotalQueries();
            stats["totalVerified"] = TotalVerified();
            stats["totalUsers"] = TotalUsers();
            stats["totalReports"] = TotalReports();

            // Configuration info
            stats["createFee"] = CREATE_FEE;
            stats["queryFee"] = QUERY_FEE;
            stats["updateFee"] = UPDATE_FEE;
            stats["verifyFee"] = VERIFY_FEE;
            stats["reportFee"] = REPORT_FEE;
            stats["maxReasonLength"] = MAX_REASON_LENGTH;

            return stats;
        }

        #endregion
    }
}
