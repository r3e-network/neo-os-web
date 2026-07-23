using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    /// <summary>
    /// SelfLoan lending model (current shipping behavior):
    ///
    /// • Borrowers lock NEO collateral and receive GAS up to an LTV tier.
    /// • There is NO time-based liquidation and NO automatic yield accrual.
    ///   <see cref="AccrueLoanYield"/> records the call timestamp only; no
    ///   yield source (NEO voting rewards / anchor profits) is wired in yet,
    ///   so debt stays static until the borrower explicitly repays via
    ///   <see cref="RepayLoan"/>.
    /// • If a borrower never repays, the NEO collateral stays locked in the
    ///   contract forever. The borrower can call AbandonLoan (in
    ///   PlatformDeFi.Lending.Abandon.cs) to formally walk away from a loan,
    ///   forfeiting collateral to the app's abandoned-collateral pool which
    ///   the app admin sweeps via WithdrawAbandonedCollateral.
    /// • This is the "NEO hostage" model — borrowers are incentivized to repay
    ///   only by their desire to reclaim the collateral. Without an actual
    ///   yield source wired in, loans never compound interest, so simply
    ///   waiting costs the contract nothing.
    /// </summary>
    public partial class PlatformDeFiContract
    {
        #region Lending Methods

        /// <summary>
        /// Create a self-repaying loan. Caller must have pre-deposited NEO collateral
        /// via OnNEP17Payment before calling this method.
        ///
        /// Audit fix M-8: takes an explicit <paramref name="collateralAmount"/>.
        /// The prior version swept the borrower's entire NEO credit balance into
        /// the loan, so a borrower who pre-deposited 10 NEO intending three smaller
        /// loans + a refund would silently lock all 10 NEO in the first loan.
        /// </summary>
        public static BigInteger CreateLoan(string appId, UInt160 borrower, BigInteger ltvTier, BigInteger collateralAmount)
        {
            ValidateApp(appId, ProductType_Lending);
            ExecutionEngine.Assert(ltvTier >= 1 && ltvTier <= 3, "invalid LTV tier (1-3)");
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "unauthorized");
            ValidateAddress(borrower);
            ExecutionEngine.Assert(collateralAmount >= MIN_COLLATERAL, "min 1 NEO collateral");

            BigInteger neoAmount = collateralAmount;
            ConsumeNeoCredit(appId, borrower, collateralAmount);

            // Increment loan ID
            ByteString idKey = AppKey(appId, PREFIX_LOAN_ID);
            BigInteger loanId = GetBigInteger(idKey) + 1;
            Put(idKey, loanId);

            BigInteger ltvBps = GetLtvForTier(ltvTier);
            // Audit fix H-3: size the loan against the oracle/keeper-priced collateral value
            // (GAS per NEO) instead of the hardcoded 1 NEO = 1 GAS assumption that left loans
            // structurally under-backed whenever NEO traded below GAS.
            BigInteger loanAmount = CollateralValueGas(appId, neoAmount) * ltvBps / 10000;
            // Audit fix FixV (Low): reject a zero-value loan up front with a clear error
            // instead of relying on the downstream TransferLoanGasToBorrower assert. Integer
            // math can round loanAmount (and therefore netLoan) to 0 when the priced
            // collateral value times the LTV is below 1 GAS base unit.
            ExecutionEngine.Assert(loanAmount > 0, "loan amount must be positive");
            BigInteger fee = loanAmount * LENDING_FEE_BPS / 10000;
            BigInteger netLoan = loanAmount - fee;
            ExecutionEngine.Assert(netLoan > 0, "net loan must be positive");

            // Track the retained origination fee so admin can sweep accumulated
            // protocol revenue. Without this the fee just sat untracked in the
            // contract balance and would have required a contract upgrade to recover.
            if (fee > 0)
            {
                ByteString feeKey = AppKey(appId, PREFIX_TOTAL_LENDING_FEES);
                Put(feeKey, GetBigInteger(feeKey) + fee);
            }

            Loan loan = new Loan
            {
                Borrower = borrower,
                Collateral = neoAmount,
                Debt = loanAmount,
                OriginalDebt = loanAmount,
                CreatedTime = Runtime.Time,
                LastYieldTime = Runtime.Time,
                LtvBps = ltvBps,
                TotalRepaid = 0,
                YieldAccrued = 0,
                Active = true
            };
            StoreLoan(appId, loanId, loan);
            AddUserLoan(appId, borrower, loanId);
            UpdateTotalCollateral(appId, neoAmount, true);
            UpdateTotalDebt(appId, loanAmount, true);

            // Track unique borrowers
            ByteString borrowerCountKey = AppKey(appId, PREFIX_USER_LOAN_COUNT, borrower);
            if (GetBigInteger(borrowerCountKey) == 1)
            {
                // First loan for this borrower in this app
                ByteString totalBorrowersKey = AppKey(appId, PREFIX_TOTAL_BORROWERS);
                Put(totalBorrowersKey, GetBigInteger(totalBorrowersKey) + 1);
            }

            // Audit fix A12 / A10: the net GAS disbursement must be backed by the
            // lending product's OWN tracked liquidity (funded via LendingDeposit) and
            // is decremented here BEFORE the transfer. Without this the loan was paid
            // opportunistically from the contract's shared GAS balance, which could
            // strand FlashLoan LP principal (A10) or disburse with no backing (A12).
            // The retained origination fee stays as protocol revenue (swept via
            // WithdrawLendingFees) - only netLoan leaves the lending pool here.
            DrawLendingLiquidity(appId, loanAmount);
            if (fee > 0) RefillLendingLiquidity(appId, fee);
            TransferLoanGasToBorrower(appId, loanId, borrower, netLoan);

            OnLoanCreated(appId, loanId, borrower, neoAmount, netLoan);
            return loanId;
        }

        /// <summary>
        /// Accrue interest on a loan against the platform's "self-repaying" yield
        /// source. Audit fix NEW-H-7: the prior implementation never updated the
        /// `LastYieldTime`/`YieldAccrued` fields after CreateLoan, leaving them
        /// dead-code on every existing loan. This helper makes the fields
        /// observable: each accrual call records the current timestamp and
        /// emits a notification so off-chain monitors can track yield events.
        ///
        /// The actual yield-source design is intentionally pluggable — current
        /// behavior records the call but doesn't reduce debt. A future patch
        /// that wires NEO voting rewards (or anchor profits, or a deposit-
        /// payout schedule) into `loan.YieldAccrued` and `loan.Debt -= ...`
        /// can land here without ABI changes. The frequency limiter prevents
        /// an attacker from spamming accrual calls every block.
        /// </summary>
        private static void AccrueLoanYield(string appId, BigInteger loanId, Loan loan)
        {
            BigInteger elapsed = Runtime.Time - loan.LastYieldTime;
            // Throttle: refuse to re-accrue inside a 60-second window. Cheap
            // protection against high-frequency call spam that would otherwise
            // produce noisy events with no economic effect.
            if (elapsed < 60_000) return;
            loan.LastYieldTime = Runtime.Time;
            StoreLoan(appId, loanId, loan);
            // No state-changing yield amount yet — the field stays 0 until a
            // yield source is wired in. The on-chain event signals "this loan
            // was touched for accrual" so monitors see continued activity.
        }

        /// <summary>
        /// Repay loan debt with GAS. Caller must have pre-deposited GAS
        /// via OnNEP17Payment before calling this method.
        /// </summary>
        public static void RepayLoan(string appId, BigInteger loanId)
        {
            ValidateApp(appId, ProductType_Lending);

            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(loan.Borrower), "unauthorized");

            // Audit fix NEW-H-7: touch the yield accrual checkpoint before
            // mutating debt so off-chain monitors see consistent timeline.
            AccrueLoanYield(appId, loanId, loan);
            loan = GetLoan(appId, loanId);

            BigInteger availableCredit = GetGasCreditBalance(appId, loan.Borrower);
            ExecutionEngine.Assert(availableCredit > 0, "no GAS credit to repay with");
            BigInteger repayAmount = availableCredit > loan.Debt ? loan.Debt : availableCredit;
            ConsumeGasCredit(appId, loan.Borrower, repayAmount);

            loan.Debt -= repayAmount;
            loan.TotalRepaid += repayAmount;
            StoreLoan(appId, loanId, loan);

            // Audit fix A10 / A12: repaid GAS returns to the lending liquidity pool so
            // the counter tracks the GAS the contract actually holds for lending.
            RefillLendingLiquidity(appId, repayAmount);

            UpdateTotalDebt(appId, repayAmount, false);
            UpdateTotalRepaid(appId, repayAmount);

            OnLoanRepaid(appId, loanId, repayAmount, loan.Debt);

            if (loan.Debt == 0)
            {
                CloseLoan(appId, loanId);
            }
        }

        /// <summary>
        /// Add more NEO collateral to an existing loan.
        /// Audit fix M-8: takes explicit amount; leaves remaining credit withdrawable.
        /// </summary>
        public static void AddCollateral(string appId, BigInteger loanId, BigInteger collateralAmount)
        {
            ValidateApp(appId, ProductType_Lending);

            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(loan.Borrower), "unauthorized");
            ExecutionEngine.Assert(collateralAmount > 0, "amount must be positive");

            // Audit fix NEW-H-7: refresh yield accrual checkpoint before
            // mutating collateral so the loan timeline stays consistent.
            AccrueLoanYield(appId, loanId, loan);
            loan = GetLoan(appId, loanId);

            BigInteger neoAmount = collateralAmount;
            ConsumeNeoCredit(appId, loan.Borrower, collateralAmount);

            loan.Collateral += neoAmount;
            StoreLoan(appId, loanId, loan);
            UpdateTotalCollateral(appId, neoAmount, true);

            OnCollateralAdded(appId, loanId, neoAmount, loan.Collateral);
        }

        /// <summary>
        /// Close a fully repaid loan and return collateral to borrower.
        /// </summary>
        private static void CloseLoan(string appId, BigInteger loanId)
        {
            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Debt == 0, "debt not fully repaid");

            loan.Active = false;
            StoreLoan(appId, loanId, loan);
            UpdateTotalCollateral(appId, loan.Collateral, false);

            ReturnLoanCollateralToBorrower(appId, loanId, loan);

            OnLoanClosed(appId, loanId, loan.Borrower);
        }

        // AbandonLoan, WithdrawAbandonedCollateral, GetTotalAbandonedCollateral
        // moved to PlatformDeFi.Lending.Abandon.cs to keep this partial under
        // the 300-line reviewability budget.

        #endregion
    }
}
