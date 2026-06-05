using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract : SmartContract
    {
        #region Platform Events

        [DisplayName("ProductRegistered")]
        public static event ProductRegisteredHandler OnProductRegistered;

        [DisplayName("AppPaused")]
        public static event AppPausedHandler OnAppPaused;

        // Lending events
        [DisplayName("LoanCreated")]
        public static event LoanCreatedHandler OnLoanCreated;

        [DisplayName("LoanRepaid")]
        public static event LoanRepaidHandler OnLoanRepaid;

        [DisplayName("LoanClosed")]
        public static event LoanClosedHandler OnLoanClosed;

        [DisplayName("CollateralAdded")]
        public static event CollateralAddedHandler OnCollateralAdded;

        [DisplayName("LoanLiquidated")]
        public static event LoanLiquidatedHandler OnLoanLiquidated;

        [DisplayName("NeoGasPriceUpdated")]
        public static event NeoGasPriceUpdatedHandler OnNeoGasPriceUpdated;

        public delegate void LoanAbandonedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger collateral);
        [DisplayName("LoanAbandoned")]
        public static event LoanAbandonedHandler OnLoanAbandoned;

        public delegate void AbandonedCollateralWithdrawnHandler(string appId, UInt160 to, BigInteger amount);
        [DisplayName("AbandonedCollateralWithdrawn")]
        public static event AbandonedCollateralWithdrawnHandler OnAbandonedCollateralWithdrawn;
        // LendingFeesWithdrawn / CapsuleFeesWithdrawn / FlashLoanFeesWithdrawn
        // events live in PlatformDeFi.FeeSweep.cs alongside their sweep methods.

        [DisplayName("ProfitAnchorConfigured")]
        public static event ProfitAnchorConfiguredHandler OnProfitAnchorConfigured;

        [DisplayName("ProfitAnchorVoteSynced")]
        public static event ProfitAnchorVoteSyncedHandler OnProfitAnchorVoteSynced;

        // FlashLoan events
        [DisplayName("FlashLoanExecuted")]
        public static event FlashLoanExecutedHandler OnFlashLoanExecuted;

        [DisplayName("FlashLiquidityDeposited")]
        public static event FlashLiquidityDepositedHandler OnFlashLiquidityDeposited;

        [DisplayName("FlashLiquidityWithdrawn")]
        public static event FlashLiquidityWithdrawnHandler OnFlashLiquidityWithdrawn;

        // Capsule events
        [DisplayName("CapsuleCreated")]
        public static event CapsuleCreatedHandler OnCapsuleCreated;

        [DisplayName("CapsuleUnlocked")]
        public static event CapsuleUnlockedHandler OnCapsuleUnlocked;

        [DisplayName("CompoundAdded")]
        public static event CompoundAddedHandler OnCompoundAdded;

        [DisplayName("EarlyWithdraw")]
        public static event EarlyWithdrawHandler OnEarlyWithdraw;

        public delegate void CapsulePenaltiesWithdrawnHandler(string appId, UInt160 to, BigInteger amount);
        [DisplayName("CapsulePenaltiesWithdrawn")]
        public static event CapsulePenaltiesWithdrawnHandler OnCapsulePenaltiesWithdrawn;

        #endregion
    }
}
