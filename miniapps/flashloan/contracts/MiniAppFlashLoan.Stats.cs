using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region Platform Stats

        /// <summary>
        /// Get comprehensive platform statistics.
        /// 
        /// RETURNS:
        /// - totalLoans: Total loans executed
        /// - totalBorrowed: Total amount borrowed
        /// - totalFees: Total fees collected
        /// - totalBorrowers: Number of unique borrowers
        /// - totalProviders: Number of liquidity providers
        /// - poolBalance: Current pool liquidity
        /// - minLoan: Minimum loan amount
        /// - maxLoan: Maximum loan amount
        /// - feeBasisPoints: Fee rate in basis points
        /// - loanCooldownSeconds: Cooldown between loans
        /// - maxDailyLoans: Daily loan limit per borrower
        /// - providerFeeShare: Provider percentage of fees
        /// </summary>
        /// <returns>Map of platform statistics</returns>
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalLoans"] = GetLoanCount();
            stats["totalBorrowed"] = GetTotalBorrowed();
            stats["totalFees"] = GetTotalFees();
            stats["totalBorrowers"] = GetTotalBorrowers();
            stats["totalProviders"] = GetTotalProviders();
            stats["poolBalance"] = GetPoolBalance();
            stats["minLoan"] = MIN_LOAN;
            stats["maxLoan"] = MAX_LOAN;
            stats["feeBasisPoints"] = FEE_BASIS_POINTS;
            stats["loanCooldownSeconds"] = LOAN_COOLDOWN_SECONDS;
            stats["maxDailyLoans"] = MAX_DAILY_LOANS;
            stats["providerFeeShare"] = PROVIDER_FEE_SHARE;
            return stats;
        }

        /// <summary>
        /// Get borrower's current eligibility status.
        /// 
        /// RETURNS:
        /// - poolBalance: Current pool liquidity
        /// - maxAvailableLoan: Maximum loan available now
        /// - cooldownRemaining: Seconds until can borrow again
        /// - canBorrow: Whether borrower can take loan now
        /// - dailyLoansUsed: Loans taken today
        /// - dailyLoansRemaining: Loans remaining today
        /// </summary>
        /// <param name="borrower">Borrower address</param>
        /// <returns>Map of eligibility info</returns>
        [Safe]
        public static Map<string, object> GetBorrowerEligibility(UInt160 borrower)
        {
            Map<string, object> eligibility = new Map<string, object>();

            BigInteger poolBalance = GetPoolBalance();
            eligibility["poolBalance"] = poolBalance;
            eligibility["maxAvailableLoan"] = poolBalance < MAX_LOAN ? poolBalance : MAX_LOAN;

            // Check cooldown
            byte[] lastLoanKey = Helper.Concat(PREFIX_BORROWER_LAST_LOAN, (ByteString)borrower);
            ByteString lastLoanData = Storage.Get(Storage.CurrentContext, lastLoanKey);
            if (lastLoanData != null)
            {
                BigInteger lastLoan = (BigInteger)lastLoanData;
                BigInteger elapsed = Runtime.Time - lastLoan;
                eligibility["cooldownRemaining"] = elapsed >= LOAN_COOLDOWN_SECONDS ? 0 : LOAN_COOLDOWN_SECONDS - elapsed;
                eligibility["canBorrow"] = elapsed >= LOAN_COOLDOWN_SECONDS;
            }
            else
            {
                eligibility["cooldownRemaining"] = 0;
                eligibility["canBorrow"] = true;
            }

            // Check daily limit
            BigInteger dailyCount = GetBorrowerDailyCount(borrower);
            eligibility["dailyLoansUsed"] = dailyCount;
            eligibility["dailyLoansRemaining"] = MAX_DAILY_LOANS - dailyCount;

            if (dailyCount >= MAX_DAILY_LOANS)
                eligibility["canBorrow"] = false;

            return eligibility;
        }

        #endregion
    }
}
