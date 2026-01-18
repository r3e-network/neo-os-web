using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get raw provider stats without calculations.
        /// Frontend calculates: successRate, tenureDays
        /// </summary>
        [Safe]
        public static Map<string, object> GetProviderStatsRaw(UInt160 provider)
        {
            ProviderStats stats = GetProviderStats(provider);
            Map<string, object> data = new Map<string, object>();

            data["totalDeposited"] = stats.TotalDeposited;
            data["currentBalance"] = stats.CurrentBalance;
            data["totalWithdrawn"] = stats.TotalWithdrawn;
            data["totalFeesEarned"] = stats.TotalFeesEarned;
            data["badgeCount"] = stats.BadgeCount;
            data["joinTime"] = stats.JoinTime;
            data["lastActivityTime"] = stats.LastActivityTime;
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Get raw borrower stats without calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetBorrowerStatsRaw(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);
            Map<string, object> data = new Map<string, object>();

            data["totalLoans"] = stats.TotalLoans;
            data["successfulLoans"] = stats.SuccessfulLoans;
            data["failedLoans"] = stats.FailedLoans;
            data["totalBorrowed"] = stats.TotalBorrowed;
            data["totalFeesPaid"] = stats.TotalFeesPaid;
            data["highestLoan"] = stats.HighestLoan;
            data["badgeCount"] = stats.BadgeCount;
            data["joinTime"] = stats.JoinTime;
            data["lastLoanTime"] = stats.LastLoanTime;
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Get flash loan constants for frontend calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetFlashLoanConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["minLoan"] = MIN_LOAN;
            constants["maxLoan"] = MAX_LOAN;
            constants["feesBasisPoints"] = FEE_BASIS_POINTS;
            constants["loanCooldownSeconds"] = LOAN_COOLDOWN_SECONDS;
            constants["maxDailyLoans"] = MAX_DAILY_LOANS;
            constants["providerFeeShare"] = PROVIDER_FEE_SHARE;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        #endregion
    }
}
