using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void LoanRequestedHandler(BigInteger loanId, UInt160 borrower, BigInteger amount);
    public delegate void LoanVerificationHandler(BigInteger loanId, BigInteger requestId);
    public delegate void LoanExecutedHandler(BigInteger loanId, UInt160 borrower, BigInteger amount, BigInteger fee, bool success);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
    public delegate void LiquidityDepositedHandler(UInt160 provider, BigInteger amount, BigInteger totalDeposited);
    public delegate void LiquidityWithdrawnHandler(UInt160 provider, BigInteger amount, BigInteger remaining);
    public delegate void BorrowerBadgeEarnedHandler(UInt160 borrower, BigInteger badgeType, string badgeName);
    public delegate void ProviderBadgeEarnedHandler(UInt160 provider, BigInteger badgeType, string badgeName);
    public delegate void FeesDistributedHandler(BigInteger totalFees, BigInteger providerShare);

    /// <summary>
    /// Flash Loan - Atomic borrow and repay with TEE verification.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Borrower requests loan via RequestLoan
    /// - Contract requests TEE to verify borrower's callback contract
    /// - TEE simulates execution to ensure repayment
    /// - Gateway fulfills → Contract executes loan atomically
    ///
    /// MECHANICS:
    /// - Borrow and repay in same transaction
    /// - 0.09% fee on borrowed amount
    /// - TEE verifies callback will repay before execution
    /// </summary>
    [DisplayName("MiniAppFlashLoan")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. FlashLoan is a flash lending protocol for atomic borrowing. Use it to borrow and repay in one transaction, you can access instant liquidity without collateral.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppFlashLoan : MiniAppServiceBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-flashloan";
        private const long MIN_LOAN = 100000000; // 1 GAS
        private const long MAX_LOAN = 10000000000000; // 100,000 GAS
        private const int FEE_BASIS_POINTS = 9; // 0.09%
        private const ulong LOAN_COOLDOWN_SECONDS = 300; // 5 minutes
        private const int MAX_DAILY_LOANS = 10;
        private const int PROVIDER_FEE_SHARE = 80; // 80% to providers
        #endregion

        #region App Prefixes (0x20+)
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_REQUEST_TO_LOAN = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_POOL_BALANCE = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_BORROWER_LAST_LOAN = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_BORROWER_DAILY_COUNT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_BORROWER_STATS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_PROVIDER_STATS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_BORROWER_BADGES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_PROVIDER_BADGES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_BORROWED = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_FEES = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_TOTAL_PROVIDERS = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        public struct LoanData
        {
            public UInt160 Borrower;
            public BigInteger Amount;
            public BigInteger Fee;
            public UInt160 CallbackContract;
            public string CallbackMethod;
            public BigInteger Timestamp;
            public bool Executed;
            public bool Success;
        }

        public struct BorrowerStats
        {
            public BigInteger TotalLoans;
            public BigInteger SuccessfulLoans;
            public BigInteger FailedLoans;
            public BigInteger TotalBorrowed;
            public BigInteger TotalFeesPaid;
            public BigInteger HighestLoan;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastLoanTime;
        }

        public struct ProviderStats
        {
            public BigInteger TotalDeposited;
            public BigInteger CurrentBalance;
            public BigInteger TotalWithdrawn;
            public BigInteger TotalFeesEarned;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region App Events
        [DisplayName("LoanRequested")]
        public static event LoanRequestedHandler OnLoanRequested;

        [DisplayName("LoanVerification")]
        public static event LoanVerificationHandler OnLoanVerification;

        [DisplayName("LoanExecuted")]
        public static event LoanExecutedHandler OnLoanExecuted;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;

        [DisplayName("LiquidityDeposited")]
        public static event LiquidityDepositedHandler OnLiquidityDeposited;

        [DisplayName("LiquidityWithdrawn")]
        public static event LiquidityWithdrawnHandler OnLiquidityWithdrawn;

        [DisplayName("BorrowerBadgeEarned")]
        public static event BorrowerBadgeEarnedHandler OnBorrowerBadgeEarned;

        [DisplayName("ProviderBadgeEarned")]
        public static event ProviderBadgeEarnedHandler OnProviderBadgeEarned;

        [DisplayName("FeesDistributed")]
        public static event FeesDistributedHandler OnFeesDistributed;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FEES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROVIDERS, 0);
        }
        #endregion

        #region Read Methods

        [Safe]
        public static BigInteger GetLoanCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LOAN_ID);

        [Safe]
        public static BigInteger GetTotalBorrowed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BORROWED);

        [Safe]
        public static BigInteger GetTotalFees() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_FEES);

        [Safe]
        public static BigInteger GetTotalBorrowers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS);

        [Safe]
        public static BigInteger GetTotalProviders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PROVIDERS);

        [Safe]
        public static BorrowerStats GetBorrowerStats(UInt160 borrower)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BORROWER_STATS, borrower));
            if (data == null) return new BorrowerStats();
            return (BorrowerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static ProviderStats GetProviderStats(UInt160 provider)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROVIDER_STATS, provider));
            if (data == null) return new ProviderStats();
            return (ProviderStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasBorrowerBadge(UInt160 borrower, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BORROWER_BADGES, borrower),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static bool HasProviderBadge(UInt160 provider, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PROVIDER_BADGES, provider),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        #endregion
    }
}
