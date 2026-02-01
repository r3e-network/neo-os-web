using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSelfLoan
    {
        #region Borrower Stats Updates

        private static void UpdateBorrowerStatsOnCreate(UInt160 borrower, BigInteger collateral, BigInteger borrowed, BigInteger ltvTier, bool isNew)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalBorrowers = TotalBorrowers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS, totalBorrowers + 1);
            }

            stats.TotalLoans += 1;
            stats.ActiveLoans += 1;
            stats.TotalBorrowed += borrowed;
            stats.TotalCollateralDeposited += collateral;
            stats.LastActivityTime = Runtime.Time;

            if (borrowed > stats.HighestLoan) stats.HighestLoan = borrowed;
            if (ltvTier == 3) stats.Tier3LoansCreated += 1;

            StoreBorrowerStats(borrower, stats);
            CheckBorrowerBadges(borrower);
        }

        private static void UpdateBorrowerStatsOnRepay(UInt160 borrower, BigInteger repaid)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);
            stats.TotalRepaid += repaid;
            stats.LastActivityTime = Runtime.Time;
            StoreBorrowerStats(borrower, stats);
            CheckBorrowerBadges(borrower);
        }

        private static void UpdateBorrowerStatsOnClose(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);
            if (stats.ActiveLoans > 0) stats.ActiveLoans -= 1;
            stats.LoansFullyRepaid += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreBorrowerStats(borrower, stats);
            CheckBorrowerBadges(borrower);
        }

        private static void UpdateBorrowerStatsOnCollateralChange(UInt160 borrower, BigInteger amount, bool isDeposit)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);
            if (isDeposit)
            {
                stats.TotalCollateralDeposited += amount;
            }
            stats.LastActivityTime = Runtime.Time;
            StoreBorrowerStats(borrower, stats);
            if (isDeposit)
            {
                CheckBorrowerBadges(borrower);
            }
        }

        #endregion
    }
}
