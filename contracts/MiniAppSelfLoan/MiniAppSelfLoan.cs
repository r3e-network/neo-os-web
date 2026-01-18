using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates for loan lifecycle
    public delegate void LoanCreatedHandler(BigInteger loanId, UInt160 borrower, BigInteger collateral, BigInteger borrowed);
    public delegate void LoanRepaidHandler(BigInteger loanId, BigInteger repaid, BigInteger remaining);
    public delegate void LoanClosedHandler(BigInteger loanId, UInt160 borrower);
    public delegate void CollateralAddedHandler(BigInteger loanId, BigInteger amount, BigInteger newTotal);
    public delegate void CollateralWithdrawnHandler(BigInteger loanId, BigInteger amount);
    public delegate void AutoRepaymentHandler(BigInteger loanId, BigInteger yieldUsed, BigInteger debtRemaining);
    public delegate void LiquidationWarningHandler(BigInteger loanId, BigInteger healthFactor);
    public delegate void BorrowerBadgeEarnedHandler(UInt160 borrower, BigInteger badgeType, string badgeName);

    /// <summary>
    /// SelfLoan MiniApp - Complete self-repaying loan protocol.
    ///
    /// FEATURES:
    /// - Multiple LTV tiers (20%, 30%, 40%)
    /// - Auto-repayment from NEO GAS yields
    /// - Add/withdraw collateral
    /// - Health factor monitoring
    /// - Liquidation protection
    /// - User loan history
    ///
    /// MECHANICS:
    /// - Deposit NEO as collateral
    /// - Borrow GAS up to LTV limit
    /// - GAS yields auto-repay debt
    /// - Maintain health factor > 1.0
    /// </summary>
    [DisplayName("MiniAppSelfLoan")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. SelfLoan is a complete self-repaying loan protocol with multiple LTV tiers, auto-repayment, collateral management, and health factor monitoring.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppSelfLoan : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-self-loan";
        private const int LTV_TIER1_BPS = 2000;  // 20% - Conservative
        private const int LTV_TIER2_BPS = 3000;  // 30% - Standard
        private const int LTV_TIER3_BPS = 4000;  // 40% - Aggressive
        private const int LIQUIDATION_THRESHOLD_BPS = 8000; // 80%
        private const int MIN_HEALTH_FACTOR = 100; // 1.0 (scaled by 100)
        private const long MIN_COLLATERAL = 100000000; // 1 NEO
        private const int MIN_LOAN_DURATION_SECONDS = 86400; // 24h anti-flash
        private const int PLATFORM_FEE_BPS = 50; // 0.5% origination fee
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_LOANS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_LOAN_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTAL_COLLATERAL = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_DEBT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_REPAID = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x29 };
        #endregion

        #region Data Structures
        public struct Loan
        {
            public UInt160 Borrower;
            public BigInteger Collateral;
            public BigInteger Debt;
            public BigInteger OriginalDebt;
            public BigInteger CreatedTime;
            public BigInteger LastYieldTime;
            public BigInteger LtvBps;
            public BigInteger TotalRepaid;
            public BigInteger YieldAccrued;
            public bool Active;
        }

        public struct BorrowerStats
        {
            public BigInteger TotalLoans;
            public BigInteger ActiveLoans;
            public BigInteger TotalBorrowed;
            public BigInteger TotalRepaid;
            public BigInteger TotalCollateralDeposited;
            public BigInteger HighestLoan;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger LoansFullyRepaid;
            public BigInteger Tier3LoansCreated;
        }
        #endregion

        #region App Events
        [DisplayName("LoanCreated")]
        public static event LoanCreatedHandler OnLoanCreated;

        [DisplayName("LoanRepaid")]
        public static event LoanRepaidHandler OnLoanRepaid;

        [DisplayName("LoanClosed")]
        public static event LoanClosedHandler OnLoanClosed;

        [DisplayName("CollateralAdded")]
        public static event CollateralAddedHandler OnCollateralAdded;

        [DisplayName("CollateralWithdrawn")]
        public static event CollateralWithdrawnHandler OnCollateralWithdrawn;

        [DisplayName("AutoRepayment")]
        public static event AutoRepaymentHandler OnAutoRepayment;

        [DisplayName("LiquidationWarning")]
        public static event LiquidationWarningHandler OnLiquidationWarning;

        [DisplayName("BorrowerBadgeEarned")]
        public static event BorrowerBadgeEarnedHandler OnBorrowerBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COLLATERAL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DEBT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REPAID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalLoans() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LOAN_ID);

        [Safe]
        public static BigInteger TotalCollateral() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COLLATERAL);

        [Safe]
        public static BigInteger TotalDebt() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DEBT);

        [Safe]
        public static BigInteger TotalBorrowers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS);

        [Safe]
        public static BorrowerStats GetBorrowerStats(UInt160 borrower)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, borrower));
            if (data == null) return new BorrowerStats();
            return (BorrowerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasBorrowerBadge(UInt160 borrower, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, borrower),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static Loan GetLoan(BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_LOANS, (ByteString)loanId.ToByteArray()));
            if (data == null) return new Loan();
            return (Loan)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetHealthFactor(BigInteger loanId)
        {
            Loan loan = GetLoan(loanId);
            if (loan.Debt == 0) return 10000;
            return loan.Collateral * LIQUIDATION_THRESHOLD_BPS / loan.Debt;
        }
        #endregion
    }
}
