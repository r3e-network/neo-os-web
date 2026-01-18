using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region Badge Logic

        /// <summary>
        /// Check and award borrower badges based on achievements.
        /// Badges: 1=FirstLoan, 2=FrequentBorrower(10), 3=HighVolume(100 GAS), 4=PerfectRecord
        /// </summary>
        private static void CheckBorrowerBadges(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);

            // Badge 1: First Loan
            if (stats.TotalLoans >= 1)
                AwardBorrowerBadge(borrower, 1, "First Loan");

            // Badge 2: Frequent Borrower (10 loans)
            if (stats.TotalLoans >= 10)
                AwardBorrowerBadge(borrower, 2, "Frequent Borrower");

            // Badge 3: High Volume (100 GAS total borrowed)
            if (stats.TotalBorrowed >= 10000000000) // 100 GAS
                AwardBorrowerBadge(borrower, 3, "High Volume");

            // Badge 4: Perfect Record (10 successful loans with no failures)
            if (stats.SuccessfulLoans >= 10 && stats.FailedLoans == 0)
                AwardBorrowerBadge(borrower, 4, "Perfect Record");
        }

        /// <summary>
        /// Check and award provider badges based on achievements.
        /// Badges: 1=FirstDeposit, 2=LiquidityKing(100 GAS), 3=LongTermProvider(30d), 4=TopEarner
        /// </summary>
        private static void CheckProviderBadges(UInt160 provider)
        {
            ProviderStats stats = GetProviderStats(provider);

            // Badge 1: First Deposit
            if (stats.TotalDeposited > 0)
                AwardProviderBadge(provider, 1, "First Deposit");

            // Badge 2: Liquidity King (100 GAS total deposited)
            if (stats.TotalDeposited >= 10000000000) // 100 GAS
                AwardProviderBadge(provider, 2, "Liquidity King");

            // Badge 3: Long Term Provider (30 days since join)
            if (stats.JoinTime > 0 && Runtime.Time - stats.JoinTime >= 2592000)
                AwardProviderBadge(provider, 3, "Long Term Provider");

            // Badge 4: Top Earner (10 GAS in fees earned)
            if (stats.TotalFeesEarned >= 1000000000) // 10 GAS
                AwardProviderBadge(provider, 4, "Top Earner");
        }

        private static void AwardBorrowerBadge(UInt160 borrower, BigInteger badgeType, string badgeName)
        {
            if (HasBorrowerBadge(borrower, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BORROWER_BADGES, borrower),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            BorrowerStats stats = GetBorrowerStats(borrower);
            stats.BadgeCount += 1;
            StoreBorrowerStats(borrower, stats);

            OnBorrowerBadgeEarned(borrower, badgeType, badgeName);
        }

        private static void AwardProviderBadge(UInt160 provider, BigInteger badgeType, string badgeName)
        {
            if (HasProviderBadge(provider, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PROVIDER_BADGES, provider),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            ProviderStats stats = GetProviderStats(provider);
            stats.BadgeCount += 1;
            StoreProviderStats(provider, stats);

            OnProviderBadgeEarned(provider, badgeType, badgeName);
        }

        #endregion
    }
}
