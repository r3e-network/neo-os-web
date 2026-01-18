using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSelfLoan
    {
        #region Query Methods

        [Safe]
        public static BigInteger GetUserLoanCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LOAN_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger[] GetUserLoans(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserLoanCount(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_LOANS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static Map<string, object> GetLoanDetails(BigInteger loanId)
        {
            Loan loan = GetLoan(loanId);
            Map<string, object> details = new Map<string, object>();
            if (loan.Borrower == UInt160.Zero) return details;

            details["id"] = loanId;
            details["borrower"] = loan.Borrower;
            details["collateral"] = loan.Collateral;
            details["debt"] = loan.Debt;
            details["originalDebt"] = loan.OriginalDebt;
            details["createdTime"] = loan.CreatedTime;
            details["ltvBps"] = loan.LtvBps;
            details["totalRepaid"] = loan.TotalRepaid;
            details["yieldAccrued"] = loan.YieldAccrued;
            details["active"] = loan.Active;
            details["healthFactor"] = GetHealthFactor(loanId);

            if (loan.Active && loan.OriginalDebt > 0)
            {
                BigInteger repaidPercent = loan.TotalRepaid * 100 / loan.OriginalDebt;
                details["repaidPercent"] = repaidPercent > 100 ? 100 : repaidPercent;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetUserStats(UInt160 user)
        {
            BorrowerStats bStats = GetBorrowerStats(user);
            Map<string, object> stats = new Map<string, object>();

            stats["loanCount"] = GetUserLoanCount(user);
            stats["totalLoans"] = bStats.TotalLoans;
            stats["activeLoans"] = bStats.ActiveLoans;
            stats["totalBorrowed"] = bStats.TotalBorrowed;
            stats["totalRepaid"] = bStats.TotalRepaid;
            stats["totalCollateralDeposited"] = bStats.TotalCollateralDeposited;
            stats["highestLoan"] = bStats.HighestLoan;
            stats["badgeCount"] = bStats.BadgeCount;
            stats["joinTime"] = bStats.JoinTime;
            stats["lastActivityTime"] = bStats.LastActivityTime;
            stats["loansFullyRepaid"] = bStats.LoansFullyRepaid;
            stats["tier3LoansCreated"] = bStats.Tier3LoansCreated;

            stats["hasFirstLoan"] = HasBorrowerBadge(user, 1);
            stats["hasRepayer"] = HasBorrowerBadge(user, 2);
            stats["hasWhale"] = HasBorrowerBadge(user, 3);
            stats["hasRiskTaker"] = HasBorrowerBadge(user, 4);
            stats["hasVeteran"] = HasBorrowerBadge(user, 5);
            stats["hasDebtFree"] = HasBorrowerBadge(user, 6);

            return stats;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalLoans"] = TotalLoans();
            stats["totalCollateral"] = TotalCollateral();
            stats["totalDebt"] = TotalDebt();
            stats["totalRepaid"] = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REPAID);
            stats["totalBorrowers"] = TotalBorrowers();

            stats["ltvTier1Bps"] = LTV_TIER1_BPS;
            stats["ltvTier2Bps"] = LTV_TIER2_BPS;
            stats["ltvTier3Bps"] = LTV_TIER3_BPS;
            stats["liquidationThresholdBps"] = LIQUIDATION_THRESHOLD_BPS;
            stats["minHealthFactor"] = MIN_HEALTH_FACTOR;
            stats["minCollateral"] = MIN_COLLATERAL;
            stats["minLoanDurationSeconds"] = MIN_LOAN_DURATION_SECONDS;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;

            return stats;
        }

        #endregion
    }
}
