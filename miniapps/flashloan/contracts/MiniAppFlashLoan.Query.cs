using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region Query Methods

        /// <summary>
        /// Get detailed loan information.
        /// 
        /// RETURNS:
        /// - id: Loan ID
        /// - borrower: Borrower address
        /// - amount: Loan amount
        /// - fee: Loan fee
        /// - callbackContract: Callback contract address
        /// - callbackMethod: Callback method name
        /// - timestamp: Request timestamp
        /// - executed: Whether executed
        /// - success: Whether successful
        /// - status: "pending", "completed", or "failed"
        /// </summary>
        /// <param name="loanId">Loan identifier</param>
        /// <returns>Map of loan details (empty if not found)</returns>
        [Safe]
        public static Map<string, object> GetLoanDetails(BigInteger loanId)
        {
            LoanData loan = GetLoan(loanId);
            Map<string, object> details = new Map<string, object>();
            if (loan.Borrower == UInt160.Zero) return details;

            details["id"] = loanId;
            details["borrower"] = loan.Borrower;
            details["amount"] = loan.Amount;
            details["fee"] = loan.Fee;
            details["callbackContract"] = loan.CallbackContract;
            details["callbackMethod"] = loan.CallbackMethod;
            details["timestamp"] = loan.Timestamp;
            details["executed"] = loan.Executed;
            details["success"] = loan.Success;

            if (!loan.Executed)
                details["status"] = "pending";
            else if (loan.Success)
                details["status"] = "completed";
            else
                details["status"] = "failed";

            return details;
        }

        /// <summary>
        /// Get detailed borrower statistics.
        /// 
        /// RETURNS:
        /// - totalLoans: Total loans taken
        /// - successfulLoans: Successful repayments
        /// - failedLoans: Failed repayments
        /// - totalBorrowed: Total amount borrowed
        /// - totalFeesPaid: Total fees paid
        /// - highestLoan: Largest loan amount
        /// - badgeCount: Achievements earned
        /// - joinTime: First loan timestamp
        /// - lastLoanTime: Most recent loan
        /// - successRate: Success rate (basis points)
        /// - hasFirstLoan, hasFrequentBorrower, hasHighVolume, hasPerfectRecord: Badge status
        /// </summary>
        /// <param name="borrower">Borrower address</param>
        /// <returns>Map of borrower statistics</returns>
        [Safe]
        public static Map<string, object> GetBorrowerStatsDetails(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);
            Map<string, object> details = new Map<string, object>();

            details["totalLoans"] = stats.TotalLoans;
            details["successfulLoans"] = stats.SuccessfulLoans;
            details["failedLoans"] = stats.FailedLoans;
            details["totalBorrowed"] = stats.TotalBorrowed;
            details["totalFeesPaid"] = stats.TotalFeesPaid;
            details["highestLoan"] = stats.HighestLoan;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastLoanTime"] = stats.LastLoanTime;

            if (stats.TotalLoans > 0)
                details["successRate"] = stats.SuccessfulLoans * 10000 / stats.TotalLoans;

            details["hasFirstLoan"] = HasBorrowerBadge(borrower, 1);
            details["hasFrequentBorrower"] = HasBorrowerBadge(borrower, 2);
            details["hasHighVolume"] = HasBorrowerBadge(borrower, 3);
            details["hasPerfectRecord"] = HasBorrowerBadge(borrower, 4);

            return details;
        }

        /// <summary>
        /// Get detailed provider statistics.
        /// 
        /// RETURNS:
        /// - totalDeposited: Total amount deposited
        /// - currentBalance: Current liquidity balance
        /// - totalWithdrawn: Total amount withdrawn
        /// - totalFeesEarned: Fees earned from pool
        /// - badgeCount: Achievements earned
        /// - joinTime: First deposit timestamp
        /// - lastActivityTime: Most recent activity
        /// - tenureDays: Days since joining
        /// - hasFirstDeposit, hasLiquidityKing, hasLongTermProvider, hasTopEarner: Badge status
        /// </summary>
        /// <param name="provider">Provider address</param>
        /// <returns>Map of provider statistics</returns>
        [Safe]
        public static Map<string, object> GetProviderStatsDetails(UInt160 provider)
        {
            ProviderStats stats = GetProviderStats(provider);
            Map<string, object> details = new Map<string, object>();

            details["totalDeposited"] = stats.TotalDeposited;
            details["currentBalance"] = stats.CurrentBalance;
            details["totalWithdrawn"] = stats.TotalWithdrawn;
            details["totalFeesEarned"] = stats.TotalFeesEarned;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            if (stats.JoinTime > 0)
                details["tenureDays"] = (Runtime.Time - stats.JoinTime) / 86400;

            details["hasFirstDeposit"] = HasProviderBadge(provider, 1);
            details["hasLiquidityKing"] = HasProviderBadge(provider, 2);
            details["hasLongTermProvider"] = HasProviderBadge(provider, 3);
            details["hasTopEarner"] = HasProviderBadge(provider, 4);

            return details;
        }

        #endregion
    }
}
