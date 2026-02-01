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
    /// <summary>
    /// SelfLoan MiniApp - Collateralized lending with automatic yield-based repayment.
    ///
    /// KEY FEATURES:
    /// - Deposit NEO as collateral to borrow GAS
    /// - Three LTV tiers: Conservative (30%), Moderate (50%), Aggressive (70%)
    /// - Automatic repayment from GAS generation
    /// - Collateral top-ups and partial withdrawals
    /// - Health factor monitoring for liquidation protection
    /// - Early repayment with no penalty
    ///
    /// SECURITY:
    /// - Over-collateralization required
    /// - Health factor monitoring
    /// - Liquidation protection
    /// - Minimum loan duration
    ///
    /// PERMISSIONS:
    /// - NEO token transfers for collateral
    /// - GAS token transfers for loans and repayment
    /// </summary>
    [DisplayName("MiniAppSelfLoan")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "SelfLoan provides collateralized lending where users deposit NEO to borrow GAS, with automatic yield-based repayment.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppSelfLoan : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the SelfLoan miniapp.</summary>
        private const string APP_ID = "miniapp-self-loan";
        
        /// <summary>Minimum collateral (1 NEO = 100,000,000).</summary>
        private const long MIN_COLLATERAL = 100000000;
        
        /// <summary>LTV for tier 1 - Conservative 30% (3000 bps).</summary>
        private const int LTV_TIER1_BPS = 3000;
        
        /// <summary>LTV for tier 2 - Moderate 50% (5000 bps).</summary>
        private const int LTV_TIER2_BPS = 5000;
        
        /// <summary>LTV for tier 3 - Aggressive 70% (7000 bps).</summary>
        private const int LTV_TIER3_BPS = 7000;
        
        /// <summary>Liquidation threshold 75% (7500 bps).</summary>
        private const int LIQUIDATION_THRESHOLD_BPS = 7500;
        
        /// <summary>Minimum health factor 1.0 (10000 bps).</summary>
        private const int MIN_HEALTH_FACTOR = 10000;
        
        /// <summary>Platform fee 1% (100 bps).</summary>
        private const int PLATFORM_FEE_BPS = 100;
        
        /// <summary>Minimum loan duration 24 hours (86,400 seconds).</summary>
        private const int MIN_LOAN_DURATION_SECONDS = 86400;
        
        /// <summary>Estimated NEO APY ~5% for auto-repayment calculations.</summary>
        private const int NEO_APY_BPS = 500;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: Current loan ID counter.</summary>
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Loan data storage.</summary>
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: User loan count.</summary>
        private static readonly byte[] PREFIX_USER_LOAN_COUNT = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: User loans list.</summary>
        private static readonly byte[] PREFIX_USER_LOANS = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Total collateral locked.</summary>
        private static readonly byte[] PREFIX_TOTAL_COLLATERAL = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Total debt outstanding.</summary>
        private static readonly byte[] PREFIX_TOTAL_DEBT = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Total repaid amount.</summary>
        private static readonly byte[] PREFIX_TOTAL_REPAID = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Borrower statistics.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: Total borrowers count.</summary>
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x28 };
        
        /// <summary>Prefix 0x29: Borrower badges.</summary>
        private static readonly byte[] PREFIX_BORROWER_BADGES = new byte[] { 0x29 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a collateralized loan.
        /// FIELDS:
        /// - Borrower: Loan owner address
        /// - Collateral: NEO amount locked
        /// - Debt: Current GAS debt
        /// - OriginalDebt: Initial GAS borrowed
        /// - CreatedTime: Loan creation timestamp
        /// - LastYieldTime: Last auto-repayment timestamp
        /// - LtvBps: Loan-to-value ratio in basis points
        /// - TotalRepaid: GAS repaid so far
        /// - YieldAccrued: Total yield used for repayment
        /// - Active: Whether loan is active
        /// </summary>
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

        /// <summary>
        /// Statistics for a borrower.
        /// FIELDS:
        /// - TotalLoans: Total loans created
        /// - ActiveLoans: Currently active loans
        /// - TotalBorrowed: Total GAS borrowed
        /// - TotalRepaid: Total GAS repaid
        /// - TotalCollateralDeposited: Total NEO deposited
        /// - HighestLoan: Largest single loan
        /// - LoansFullyRepaid: Count of completed loans
        /// - Tier3LoansCreated: Count of aggressive tier loans
        /// - BadgeCount: Number of badges earned
        /// - JoinTime: First loan timestamp
        /// - LastActivityTime: Most recent activity
        /// </summary>
        public struct BorrowerStats
        {
            public BigInteger TotalLoans;
            public BigInteger ActiveLoans;
            public BigInteger TotalBorrowed;
            public BigInteger TotalRepaid;
            public BigInteger TotalCollateralDeposited;
            public BigInteger HighestLoan;
            public BigInteger LoansFullyRepaid;
            public BigInteger Tier3LoansCreated;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when loan is created.</summary>
        /// <param name="loanId">Unique loan identifier.</param>
        /// <param name="borrower">Borrower address.</param>
        /// <param name="collateral">NEO collateral amount.</param>
        /// <param name="loanAmount">GAS borrowed amount.</param>
        public delegate void LoanCreatedHandler(BigInteger loanId, UInt160 borrower, BigInteger collateral, BigInteger loanAmount);
        
        /// <summary>Event emitted when loan is repaid.</summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <param name="amount">Repayment amount.</param>
        /// <param name="remainingDebt">Remaining debt after repayment.</param>
        public delegate void LoanRepaidHandler(BigInteger loanId, BigInteger amount, BigInteger remainingDebt);
        
        /// <summary>Event emitted when loan is closed.</summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <param name="borrower">Borrower address.</param>
        public delegate void LoanClosedHandler(BigInteger loanId, UInt160 borrower);
        
        /// <summary>Event emitted when auto-repayment occurs.</summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <param name="amount">Auto-repayment amount.</param>
        /// <param name="remainingDebt">Remaining debt.</param>
        public delegate void AutoRepaymentHandler(BigInteger loanId, BigInteger amount, BigInteger remainingDebt);
        
        /// <summary>Event emitted when liquidation warning triggered.</summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <param name="healthFactor">Current health factor.</param>
        public delegate void LiquidationWarningHandler(BigInteger loanId, BigInteger healthFactor);
        
        /// <summary>Event emitted when borrower earns a badge.</summary>
        /// <param name="borrower">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        public delegate void BorrowerBadgeEarnedHandler(UInt160 borrower, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("LoanCreated")]
        public static event LoanCreatedHandler OnLoanCreated;

        [DisplayName("LoanRepaid")]
        public static event LoanRepaidHandler OnLoanRepaid;

        [DisplayName("LoanClosed")]
        public static event LoanClosedHandler OnLoanClosed;

        [DisplayName("AutoRepayment")]
        public static event AutoRepaymentHandler OnAutoRepayment;

        [DisplayName("LiquidationWarning")]
        public static event LiquidationWarningHandler OnLiquidationWarning;

        [DisplayName("BorrowerBadgeEarned")]
        public static event BorrowerBadgeEarnedHandler OnBorrowerBadgeEarned;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
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
        /// <summary>
        /// Gets total loans count.
        /// </summary>
        /// <returns>Total loans created.</returns>
        [Safe]
        public static BigInteger TotalLoans() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LOAN_ID);

        /// <summary>
        /// Gets total NEO collateral locked.
        /// </summary>
        /// <returns>Total collateral amount.</returns>
        [Safe]
        public static BigInteger TotalCollateral() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COLLATERAL);

        /// <summary>
        /// Gets total GAS debt outstanding.
        /// </summary>
        /// <returns>Total debt amount.</returns>
        [Safe]
        public static BigInteger TotalDebt() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DEBT);

        /// <summary>
        /// Gets total GAS repaid.
        /// </summary>
        /// <returns>Total repaid amount.</returns>
        [Safe]
        public static BigInteger TotalRepaid() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REPAID);

        /// <summary>
        /// Gets total unique borrowers.
        /// </summary>
        /// <returns>Total borrowers count.</returns>
        [Safe]
        public static BigInteger TotalBorrowers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BORROWERS);

        /// <summary>
        /// Gets loan data by ID.
        /// </summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <returns>Loan struct.</returns>
        [Safe]
        public static Loan GetLoan(BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_LOANS, (ByteString)loanId.ToByteArray()));
            if (data == null) return new Loan();
            return (Loan)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets borrower statistics.
        /// </summary>
        /// <param name="borrower">Borrower address.</param>
        /// <returns>Borrower stats struct.</returns>
        [Safe]
        public static BorrowerStats GetBorrowerStats(UInt160 borrower)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, borrower));
            if (data == null) return new BorrowerStats();
            return (BorrowerStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Calculates health factor for a loan.
        /// </summary>
        /// <param name="loanId">Loan identifier.</param>
        /// <returns>Health factor in basis points (10000 = 1.0).</returns>
        [Safe]
        public static BigInteger GetHealthFactor(BigInteger loanId)
        {
            Loan loan = GetLoan(loanId);
            if (!loan.Active) return 0;
            if (loan.Debt == 0) return 10000;
            return loan.Collateral * LIQUIDATION_THRESHOLD_BPS / loan.Debt;
        }

        /// <summary>
        /// Gets maximum borrowable amount for collateral.
        /// </summary>
        /// <param name="collateral">NEO collateral amount.</param>
        /// <param name="ltvTier">LTV tier (1-3).</param>
        /// <returns>Maximum GAS borrowable.</returns>
        [Safe]
        public static BigInteger GetMaxBorrowAmount(BigInteger collateral, BigInteger ltvTier)
        {
            BigInteger ltvBps = ltvTier == 1 ? LTV_TIER1_BPS :
                               ltvTier == 2 ? LTV_TIER2_BPS : LTV_TIER3_BPS;
            return collateral * ltvBps / 10000;
        }

        /// <summary>
        /// Checks if borrower has a specific badge.
        /// </summary>
        /// <param name="borrower">Borrower address.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <returns>True if borrower has badge.</returns>
        [Safe]
        public static bool HasBorrowerBadge(UInt160 borrower, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BORROWER_BADGES, borrower),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Badge Logic
        private static void CheckBorrowerBadges(UInt160 borrower)
        {
            BorrowerStats stats = GetBorrowerStats(borrower);

            // Badge 1: First Loan
            if (stats.TotalLoans >= 1 && !HasBorrowerBadge(borrower, 1))
            {
                AwardBorrowerBadge(borrower, 1, "First Loan");
            }

            // Badge 2: Active Borrower (3+ active loans)
            if (stats.ActiveLoans >= 3 && !HasBorrowerBadge(borrower, 2))
            {
                AwardBorrowerBadge(borrower, 2, "Active Borrower");
            }

            // Badge 3: Big Player (100+ NEO collateral)
            if (stats.TotalCollateralDeposited >= 10000000000 && !HasBorrowerBadge(borrower, 3))
            {
                AwardBorrowerBadge(borrower, 3, "Big Player");
            }

            // Badge 4: Debt Free (5+ fully repaid loans)
            if (stats.LoansFullyRepaid >= 5 && !HasBorrowerBadge(borrower, 4))
            {
                AwardBorrowerBadge(borrower, 4, "Debt Free");
            }

            // Badge 5: Risk Taker (tier 3 loans)
            if (stats.Tier3LoansCreated >= 1 && !HasBorrowerBadge(borrower, 5))
            {
                AwardBorrowerBadge(borrower, 5, "Risk Taker");
            }
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
        #endregion
    }
}
