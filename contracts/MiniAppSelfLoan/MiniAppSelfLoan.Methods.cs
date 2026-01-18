using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSelfLoan
    {
        #region User Methods

        /// <summary>
        /// Create a new self-repaying loan with LTV tier selection.
        /// </summary>
        public static BigInteger CreateLoan(UInt160 borrower, BigInteger neoAmount, BigInteger ltvTier)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(neoAmount >= MIN_COLLATERAL, "min 1 NEO collateral");
            ExecutionEngine.Assert(ltvTier >= 1 && ltvTier <= 3, "invalid LTV tier (1-3)");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(borrower), "unauthorized");

            bool transferred = NEO.Transfer(borrower, Runtime.ExecutingScriptHash, neoAmount);
            ExecutionEngine.Assert(transferred, "NEO transfer failed");

            BigInteger loanId = TotalLoans() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, loanId);

            BigInteger ltvBps = GetLtvForTier(ltvTier);
            BigInteger loanAmount = neoAmount * ltvBps / 10000;
            BigInteger fee = loanAmount * PLATFORM_FEE_BPS / 10000;
            BigInteger netLoan = loanAmount - fee;

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
            StoreLoan(loanId, loan);

            AddUserLoan(borrower, loanId);
            UpdateTotalCollateral(neoAmount, true);
            UpdateTotalDebt(loanAmount, true);

            BorrowerStats stats = GetBorrowerStats(borrower);
            bool isNewBorrower = stats.JoinTime == 0;
            UpdateBorrowerStatsOnCreate(borrower, neoAmount, loanAmount, ltvTier, isNewBorrower);

            bool loanTransferred = GAS.Transfer(Runtime.ExecutingScriptHash, borrower, netLoan);
            ExecutionEngine.Assert(loanTransferred, "GAS transfer failed");

            OnLoanCreated(loanId, borrower, neoAmount, netLoan);
            return loanId;
        }

        /// <summary>
        /// Repay debt manually with GAS.
        /// </summary>
        public static void RepayDebt(BigInteger loanId, UInt160 payer, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Loan loan = GetLoan(loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(payer), "unauthorized");

            ExecutionEngine.Assert(Runtime.Time >= loan.CreatedTime + MIN_LOAN_DURATION_SECONDS, "min 24h loan duration");

            ValidatePaymentReceipt(APP_ID, payer, amount, receiptId);

            BigInteger repayAmount = amount > loan.Debt ? loan.Debt : amount;

            loan.Debt -= repayAmount;
            loan.TotalRepaid += repayAmount;
            StoreLoan(loanId, loan);

            UpdateTotalDebt(repayAmount, false);
            UpdateTotalRepaid(repayAmount);
            UpdateBorrowerStatsOnRepay(loan.Borrower, repayAmount);

            OnLoanRepaid(loanId, repayAmount, loan.Debt);

            if (loan.Debt == 0)
            {
                CloseLoan(loanId);
            }
        }

        /// <summary>
        /// Add more collateral to improve health factor.
        /// </summary>
        public static void AddCollateral(BigInteger loanId, UInt160 depositor, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);

            Loan loan = GetLoan(loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(depositor), "unauthorized");

            bool transferred = NEO.Transfer(depositor, Runtime.ExecutingScriptHash, neoAmount);
            ExecutionEngine.Assert(transferred, "NEO transfer failed");

            loan.Collateral += neoAmount;
            StoreLoan(loanId, loan);

            UpdateTotalCollateral(neoAmount, true);
            UpdateBorrowerStatsOnCollateralChange(loan.Borrower, neoAmount, true);

            OnCollateralAdded(loanId, neoAmount, loan.Collateral);
        }

        /// <summary>
        /// Withdraw excess collateral while maintaining safe health factor.
        /// </summary>
        public static void WithdrawCollateral(BigInteger loanId, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);

            Loan loan = GetLoan(loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(loan.Borrower), "unauthorized");
            ExecutionEngine.Assert(neoAmount > 0 && neoAmount < loan.Collateral, "invalid amount");

            BigInteger newCollateral = loan.Collateral - neoAmount;
            BigInteger newHealthFactor = loan.Debt > 0
                ? newCollateral * LIQUIDATION_THRESHOLD_BPS / loan.Debt
                : 10000;

            ExecutionEngine.Assert(newHealthFactor >= MIN_HEALTH_FACTOR * 15 / 10, "health factor too low");

            loan.Collateral = newCollateral;
            StoreLoan(loanId, loan);

            UpdateTotalCollateral(neoAmount, false);

            NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, neoAmount);

            OnCollateralWithdrawn(loanId, neoAmount);
        }

        /// <summary>
        /// Close a fully repaid loan and return collateral.
        /// </summary>
        private static void CloseLoan(BigInteger loanId)
        {
            Loan loan = GetLoan(loanId);
            ExecutionEngine.Assert(loan.Debt == 0, "debt not fully repaid");

            loan.Active = false;
            StoreLoan(loanId, loan);

            UpdateTotalCollateral(loan.Collateral, false);
            UpdateBorrowerStatsOnClose(loan.Borrower);

            NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral);

            OnLoanClosed(loanId, loan.Borrower);
        }

        #endregion

        #region Automation

        /// <summary>
        /// Process auto-repayment from accumulated GAS yields.
        /// </summary>
        public static void ProcessAutoRepayment(BigInteger loanId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Loan loan = GetLoan(loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");

            // Calculate yield since last processing
            BigInteger elapsed = Runtime.Time - loan.LastYieldTime;
            if (elapsed <= 0) return;

            // Estimate GAS yield (simplified: ~5% APY on NEO)
            BigInteger yearSeconds = 365 * 86400;
            BigInteger estimatedYield = loan.Collateral * 500 * elapsed / (10000 * yearSeconds);

            if (estimatedYield > 0)
            {
                BigInteger repayAmount = estimatedYield > loan.Debt ? loan.Debt : estimatedYield;

                loan.Debt -= repayAmount;
                loan.TotalRepaid += repayAmount;
                loan.YieldAccrued += estimatedYield;
                loan.LastYieldTime = Runtime.Time;
                StoreLoan(loanId, loan);

                UpdateTotalDebt(repayAmount, false);
                UpdateTotalRepaid(repayAmount);

                OnAutoRepayment(loanId, repayAmount, loan.Debt);

                // Check health factor and emit warning if needed
                BigInteger healthFactor = GetHealthFactor(loanId);
                if (healthFactor < MIN_HEALTH_FACTOR * 15 / 10)
                {
                    OnLiquidationWarning(loanId, healthFactor);
                }

                // Auto-close if fully repaid
                if (loan.Debt == 0)
                {
                    CloseLoan(loanId);
                }
            }
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            // Process batch of loans for auto-repayment
            if (payload != null && payload.Length > 0)
            {
                BigInteger[] loanIds = (BigInteger[])StdLib.Deserialize(payload);
                foreach (BigInteger loanId in loanIds)
                {
                    Loan loan = GetLoan(loanId);
                    if (!loan.Active)
                    {
                        continue;
                    }
                    ProcessAutoRepayment(loanId);
                }
            }
        }

        #endregion
    }
}
