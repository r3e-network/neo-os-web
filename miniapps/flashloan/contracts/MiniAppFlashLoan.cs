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
    /// <summary>Event emitted when a flash loan is requested.</summary>
    /// <param name="loanId">Unique loan identifier</param>
    /// <param name="borrower">Borrower address</param>
    /// <param name="amount">Loan amount in GAS</param>
    public delegate void LoanRequestedHandler(BigInteger loanId, UInt160 borrower, BigInteger amount);
    
    /// <summary>Event emitted when loan verification is initiated.</summary>
    /// <param name="loanId">Loan identifier</param>
    /// <param name="requestId">TEE verification request ID</param>
    public delegate void LoanVerificationHandler(BigInteger loanId, BigInteger requestId);
    
    /// <summary>Event emitted when a loan is executed.</summary>
    /// <param name="loanId">Loan identifier</param>
    /// <param name="borrower">Borrower address</param>
    /// <param name="amount">Loan amount</param>
    /// <param name="fee">Fee paid</param>
    /// <param name="success">Whether execution succeeded</param>
    public delegate void LoanExecutedHandler(BigInteger loanId, UInt160 borrower, BigInteger amount, BigInteger fee, bool success);
    
    /// <summary>Event emitted when periodic task executes.</summary>
    /// <param name="taskId">Task identifier</param>
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
    
    /// <summary>Event emitted when liquidity is deposited.</summary>
    /// <param name="provider">Liquidity provider address</param>
    /// <param name="amount">Deposit amount</param>
    /// <param name="totalDeposited">Provider's total deposit</param>
    public delegate void LiquidityDepositedHandler(UInt160 provider, BigInteger amount, BigInteger totalDeposited);
    
    /// <summary>Event emitted when liquidity is withdrawn.</summary>
    /// <param name="provider">Liquidity provider address</param>
    /// <param name="amount">Withdrawal amount</param>
    /// <param name="remaining">Provider's remaining balance</param>
    public delegate void LiquidityWithdrawnHandler(UInt160 provider, BigInteger amount, BigInteger remaining);
    
    /// <summary>Event emitted when borrower earns a badge.</summary>
    /// <param name="borrower">Borrower address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Badge name</param>
    public delegate void BorrowerBadgeEarnedHandler(UInt160 borrower, BigInteger badgeType, string badgeName);
    
    /// <summary>Event emitted when provider earns a badge.</summary>
    /// <param name="provider">Provider address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Badge name</param>
    public delegate void ProviderBadgeEarnedHandler(UInt160 provider, BigInteger badgeType, string badgeName);
    
    /// <summary>Event emitted when fees are distributed.</summary>
    /// <param name="totalFees">Total fees distributed</param>
    /// <param name="providerShare">Share going to providers</param>
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
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    public partial class MiniAppFlashLoan : MiniAppServiceBase
    {
        #region App Constants
        /// <summary>Unique app identifier.</summary>
        private const string APP_ID = "miniapp-flashloan";
        /// <summary>Minimum loan amount: 1 GAS (100,000,000 neo-atomic units).</summary>
        private const long MIN_LOAN = 100000000;
        /// <summary>Maximum loan amount: 100,000 GAS (10,000,000,000,000 neo-atomic units).</summary>
        private const long MAX_LOAN = 10000000000000;
        /// <summary>Fee rate in basis points: 9 = 0.09%.</summary>
        private const int FEE_BASIS_POINTS = 9;
        /// <summary>Cooldown between loans: 5 minutes (300 seconds).</summary>
        private const ulong LOAN_COOLDOWN_SECONDS = 300;
        /// <summary>Maximum loans per day per borrower.</summary>
        private const int MAX_DAILY_LOANS = 10;
        /// <summary>Provider fee share percentage: 80%.</summary>
        private const int PROVIDER_FEE_SHARE = 80;
        #endregion

        #region Storage Prefixes (0x20-0x2D)
        // STORAGE LAYOUT: Flash Loan app data (0x20-0x2D)
        
        /// <summary>Prefix 0x20: Loan ID counter.</summary>
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        /// <summary>Prefix 0x21: Loan data storage.</summary>
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        /// <summary>Prefix 0x22: Request ID to loan ID mapping.</summary>
        private static readonly byte[] PREFIX_REQUEST_TO_LOAN = new byte[] { 0x22 };
        /// <summary>Prefix 0x23: Pool balance storage.</summary>
        private static readonly byte[] PREFIX_POOL_BALANCE = new byte[] { 0x23 };
        /// <summary>Prefix 0x24: Borrower last loan time.</summary>
        private static readonly byte[] PREFIX_BORROWER_LAST_LOAN = new byte[] { 0x24 };
        /// <summary>Prefix 0x25: Borrower daily loan count.</summary>
        private static readonly byte[] PREFIX_BORROWER_DAILY_COUNT = new byte[] { 0x25 };
        /// <summary>Prefix 0x26: Borrower statistics.</summary>
        private static readonly byte[] PREFIX_BORROWER_STATS = new byte[] { 0x26 };
        /// <summary>Prefix 0x27: Provider statistics.</summary>
        private static readonly byte[] PREFIX_PROVIDER_STATS = new byte[] { 0x27 };
        /// <summary>Prefix 0x28: Borrower badges.</summary>
        private static readonly byte[] PREFIX_BORROWER_BADGES = new byte[] { 0x28 };
        /// <summary>Prefix 0x29: Provider badges.</summary>
        private static readonly byte[] PREFIX_PROVIDER_BADGES = new byte[] { 0x29 };
        /// <summary>Prefix 0x2A: Total borrowed amount.</summary>
        private static readonly byte[] PREFIX_TOTAL_BORROWED = new byte[] { 0x2A };
        /// <summary>Prefix 0x2B: Total fees collected.</summary>
        private static readonly byte[] PREFIX_TOTAL_FEES = new byte[] { 0x2B };
        /// <summary>Prefix 0x2C: Total borrowers count.</summary>
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x2C };
        /// <summary>Prefix 0x2D: Total providers count.</summary>
        private static readonly byte[] PREFIX_TOTAL_PROVIDERS = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        
        /// <summary>
        /// Flash loan data structure.
        /// 
        /// FIELDS:
        /// - Borrower: Loan borrower address
        /// - Amount: Loan amount in GAS
        /// - Fee: Fee charged for loan
        /// - CallbackContract: Contract to call for loan execution
        /// - CallbackMethod: Method to invoke on callback contract
        /// - Timestamp: Loan request timestamp
        /// - Executed: Whether loan was executed
        /// - Success: Whether execution succeeded
        /// </summary>
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

        /// <summary>
        /// Borrower statistics structure.
        /// 
        /// FIELDS:
        /// - TotalLoans: Total loans taken
        /// - SuccessfulLoans: Successfully repaid loans
        /// - FailedLoans: Failed repayments
        /// - TotalBorrowed: Total amount borrowed
        /// - TotalFeesPaid: Total fees paid
        /// - HighestLoan: Largest single loan
        /// - BadgeCount: Achievements earned
        /// - JoinTime: First loan timestamp
        /// - LastLoanTime: Most recent loan timestamp
        /// </summary>
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

        /// <summary>
        /// Liquidity provider statistics structure.
        /// 
        /// FIELDS:
        /// - TotalDeposited: Total amount deposited
        /// - CurrentBalance: Current liquidity balance
        /// - TotalWithdrawn: Total amount withdrawn
        /// - TotalFeesEarned: Fees earned from loans
        /// - BadgeCount: Achievements earned
        /// - JoinTime: First deposit timestamp
        /// - LastActivityTime: Most recent activity
        /// </summary>
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
        /// <summary>Emitted when a loan is requested.</summary>
        [DisplayName("LoanRequested")]
        public static event LoanRequestedHandler OnLoanRequested;

        /// <summary>Emitted when loan verification starts.</summary>
        [DisplayName("LoanVerification")]
        public static event LoanVerificationHandler OnLoanVerification;

        /// <summary>Emitted when a loan is executed.</summary>
        [DisplayName("LoanExecuted")]
        public static event LoanExecutedHandler OnLoanExecuted;

        /// <summary>Emitted when periodic task runs.</summary>
        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;

        /// <summary>Emitted when liquidity is deposited.</summary>
        [DisplayName("LiquidityDeposited")]
        public static event LiquidityDepositedHandler OnLiquidityDeposited;

        /// <summary>Emitted when liquidity is withdrawn.</summary>
        [DisplayName("LiquidityWithdrawn")]
        public static event LiquidityWithdrawnHandler OnLiquidityWithdrawn;

        /// <summary>Emitted when borrower earns badge.</summary>
        [DisplayName("BorrowerBadgeEarned")]
        public static event BorrowerBadgeEarnedHandler OnBorrowerBadgeEarned;

        /// <summary>Emitted when provider earns badge.</summary>
        [DisplayName("ProviderBadgeEarned")]
        public static event ProviderBadgeEarnedHandler OnProviderBadgeEarned;

        /// <summary>Emitted when fees are distributed.</summary>
        [DisplayName("FeesDistributed")]
        public static event FeesDistributedHandler OnFeesDistributed;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// 
        /// INITIALIZATION:
        /// - Sets deployer as admin
        /// - Initializes loan ID counter
        /// - Resets pool balance and totals
        /// </summary>
        /// <param name="data">Deployment data (unused)</param>
        /// <param name="update">Whether this is a contract update</param>
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
