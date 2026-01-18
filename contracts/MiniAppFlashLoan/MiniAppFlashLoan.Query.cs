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
