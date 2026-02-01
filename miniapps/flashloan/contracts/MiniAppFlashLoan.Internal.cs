using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region Internal Helpers

        /// <summary>Serialize and store loan data.</summary>
        /// <param name="loanId">Loan identifier</param>
        /// <param name="loan">Loan data struct</param>
        private static void StoreLoan(BigInteger loanId, LoanData loan)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_LOANS, (ByteString)loanId.ToByteArray()),
                StdLib.Serialize(loan));
        }

        /// <summary>
        /// Validates borrower hasn't exceeded loan frequency limits.
        /// Anti-abuse: 5 min cooldown + max 10 loans/day.
        /// </summary>
        private static void ValidateLoanCooldown(UInt160 borrower)
        {
            // Check cooldown
            byte[] lastLoanKey = Helper.Concat(PREFIX_BORROWER_LAST_LOAN, (ByteString)borrower);
            ByteString lastLoanData = Storage.Get(Storage.CurrentContext, lastLoanKey);
            if (lastLoanData != null)
            {
                BigInteger lastLoan = (BigInteger)lastLoanData;
                BigInteger elapsed = Runtime.Time - lastLoan;
                ExecutionEngine.Assert(elapsed >= LOAN_COOLDOWN_SECONDS, "wait 5 min between loans");
            }

            // Check daily limit
            BigInteger dailyCount = GetBorrowerDailyCount(borrower);
            ExecutionEngine.Assert(dailyCount < MAX_DAILY_LOANS, "max 10 loans per day");
        }

        /// <summary>
        /// Records loan request for rate limiting.
        /// </summary>
        private static void RecordLoanRequest(UInt160 borrower)
        {
            // Update last loan time
            byte[] lastLoanKey = Helper.Concat(PREFIX_BORROWER_LAST_LOAN, (ByteString)borrower);
            Storage.Put(Storage.CurrentContext, lastLoanKey, Runtime.Time);

            // Update daily count
            BigInteger currentDay = Runtime.Time / 86400;
            byte[] countKey = Helper.Concat(PREFIX_BORROWER_DAILY_COUNT, (ByteString)borrower);
            ByteString countData = Storage.Get(Storage.CurrentContext, countKey);

            BigInteger count = 1;
            if (countData != null)
            {
                object[] stored = (object[])StdLib.Deserialize(countData);
                BigInteger storedDay = (BigInteger)stored[0];
                if (storedDay == currentDay)
                {
                    count = (BigInteger)stored[1] + 1;
                }
            }
            Storage.Put(Storage.CurrentContext, countKey,
                StdLib.Serialize(new object[] { currentDay, count }));
        }

        /// <summary>
        /// Gets borrower's loan count for current day.
        /// </summary>
        private static BigInteger GetBorrowerDailyCount(UInt160 borrower)
        {
            byte[] countKey = Helper.Concat(PREFIX_BORROWER_DAILY_COUNT, (ByteString)borrower);
            ByteString countData = Storage.Get(Storage.CurrentContext, countKey);
            if (countData == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(countData);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        /// <summary>Serialize and store borrower statistics.</summary>
        /// <param name="borrower">Borrower address</param>
        /// <param name="stats">Borrower stats struct</param>
        private static void StoreBorrowerStats(UInt160 borrower, BorrowerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BORROWER_STATS, borrower),
                StdLib.Serialize(stats));
        }

        /// <summary>Serialize and store provider statistics.</summary>
        /// <param name="provider">Provider address</param>
        /// <param name="stats">Provider stats struct</param>
        private static void StoreProviderStats(UInt160 provider, ProviderStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROVIDER_STATS, provider),
                StdLib.Serialize(stats));
        }

        private static void UpdateBorrowerStatsOnLoan(UInt160 borrower, BigInteger amount, BigInteger fee, bool success, bool isNew)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalBorrowers = GetTotalBorrowers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS, totalBorrowers + 1);
            }

            stats.TotalLoans += 1;
            stats.LastLoanTime = Runtime.Time;

            if (success)
            {
                stats.SuccessfulLoans += 1;
                stats.TotalBorrowed += amount;
                stats.TotalFeesPaid += fee;

                if (amount > stats.HighestLoan)
                {
                    stats.HighestLoan = amount;
                }

                // Update global stats
                BigInteger totalBorrowed = GetTotalBorrowed();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWED, totalBorrowed + amount);

                BigInteger totalFees = GetTotalFees();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FEES, totalFees + fee);
            }
            else
            {
                stats.FailedLoans += 1;
            }

            StoreBorrowerStats(borrower, stats);
            CheckBorrowerBadges(borrower);
        }

        private static void UpdateProviderStatsOnDeposit(UInt160 provider, BigInteger amount, bool isNew)
        {
            ProviderStats stats = GetProviderStats(provider);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalProviders = GetTotalProviders();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROVIDERS, totalProviders + 1);
            }

            stats.TotalDeposited += amount;
            stats.CurrentBalance += amount;
            stats.LastActivityTime = Runtime.Time;

            StoreProviderStats(provider, stats);
        }

        #endregion
    }
}
