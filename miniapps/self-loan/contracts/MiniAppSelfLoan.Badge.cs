using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSelfLoan
    {
        #region Badge Logic

        /// <summary>
        /// Check and award borrower badges based on achievements.
        /// Badges: 1=FirstLoan, 2=Repayer(5 fully repaid), 3=Whale(100 NEO collateral),
        ///         4=RiskTaker(5 tier3 loans), 5=Veteran(10 loans), 6=DebtFree(all loans repaid, 0 active)
        /// </summary>
        private static void CheckBorrowerBadges(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);

            if (stats.TotalLoans >= 1)
                AwardBorrowerBadge(borrower, 1, "First Loan");

            if (stats.LoansFullyRepaid >= 5)
                AwardBorrowerBadge(borrower, 2, "Repayer");

            if (stats.TotalCollateralDeposited >= 10000000000) // 100 NEO
                AwardBorrowerBadge(borrower, 3, "Whale");

            if (stats.Tier3LoansCreated >= 5)
                AwardBorrowerBadge(borrower, 4, "Risk Taker");

            if (stats.TotalLoans >= 10)
                AwardBorrowerBadge(borrower, 5, "Veteran");

            if (stats.LoansFullyRepaid >= 1 && stats.ActiveLoans == 0)
                AwardBorrowerBadge(borrower, 6, "Debt Free");
        }

        private static void AwardBorrowerBadge(UInt160 borrower, BigInteger badgeType, string badgeName)
        {
            if (HasBorrowerBadge(borrower, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, borrower),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            BorrowerStats stats = GetBorrowerStats(borrower);
            stats.BadgeCount += 1;
            StoreBorrowerStats(borrower, stats);

        }

        #endregion
    }
}
