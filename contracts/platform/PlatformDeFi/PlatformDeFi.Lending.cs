using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        #region Lending Methods

        /// <summary>
        /// Create a self-repaying loan. Caller must have pre-deposited NEO collateral
        /// via OnNEP17Payment before calling this method.
        /// </summary>
        public static BigInteger CreateLoan(string appId, UInt160 borrower, BigInteger ltvTier)
        {
            ValidateApp(appId, ProductType_Lending);
            ExecutionEngine.Assert(ltvTier >= 1 && ltvTier <= 3, "invalid LTV tier (1-3)");
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "unauthorized");
            ValidateAddress(borrower);

            // Read and consume the borrower's prepaid NEO credit
            StorageMap neoCredits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString creditKey = (ByteString)(byte[])borrower;
            ByteString creditData = neoCredits.Get(creditKey);
            BigInteger neoAmount = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(neoAmount >= MIN_COLLATERAL, "min 1 NEO collateral");

            // Consume all NEO credit as collateral
            neoCredits.Delete(creditKey);

            // Increment loan ID
            ByteString idKey = AppKey(appId, PREFIX_LOAN_ID);
            BigInteger loanId = GetBigInteger(idKey) + 1;
            Put(idKey, loanId);

            BigInteger ltvBps = GetLtvForTier(ltvTier);
            BigInteger loanAmount = neoAmount * GAS_FIXED8 * ltvBps / 10000;
            BigInteger fee = loanAmount * LENDING_FEE_BPS / 10000;
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

            TransferLoanGasToBorrower(appId, loanId, borrower, netLoan);

            OnLoanCreated(appId, loanId, borrower, neoAmount, netLoan);
            return loanId;
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

            // Consume all prepaid GAS credit for repayment
            StorageMap gasCredits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
            ByteString creditKey = (ByteString)(byte[])loan.Borrower;
            ByteString creditData = gasCredits.Get(creditKey);
            BigInteger amount = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(amount > 0, "no GAS credit to repay with");
            gasCredits.Delete(creditKey);

            BigInteger repayAmount = amount > loan.Debt ? loan.Debt : amount;

            // Refund excess
            if (amount > loan.Debt)
            {
                BigInteger excess = amount - loan.Debt;
                gasCredits.Put(creditKey, excess);
            }

            loan.Debt -= repayAmount;
            loan.TotalRepaid += repayAmount;
            StoreLoan(appId, loanId, loan);

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
        /// Caller must have pre-deposited NEO via OnNEP17Payment.
        /// </summary>
        public static void AddCollateral(string appId, BigInteger loanId)
        {
            ValidateApp(appId, ProductType_Lending);

            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(loan.Borrower), "unauthorized");

            // Consume all prepaid NEO credit
            StorageMap neoCredits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString creditKey = (ByteString)(byte[])loan.Borrower;
            ByteString creditData = neoCredits.Get(creditKey);
            BigInteger neoAmount = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(neoAmount > 0, "no NEO credit to add");
            neoCredits.Delete(creditKey);

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

        #endregion
    }
}
