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
    public delegate void LoanCreatedHandler(BigInteger loanId, UInt160 borrower, BigInteger collateral, BigInteger borrowed);
    public delegate void LoanRepaidHandler(BigInteger loanId, BigInteger repaid, BigInteger remaining);
    public delegate void LoanClosedHandler(BigInteger loanId, UInt160 borrower);

    /// <summary>
    /// Self-Repaying Loan - Alchemix-style auto-repaying loans.
    /// Collateral yields automatically repay the debt.
    /// </summary>
    [DisplayName("MiniAppSelfLoan")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. SelfLoan is a self-repaying loan protocol for automated debt management. Use it to borrow against collateral with yield-based repayment, you can access liquidity while your collateral automatically pays down debt.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-self-loan";
        private const int LTV_PERCENT = 20; // 20% loan-to-value
        private const ulong MIN_LOAN_DURATION = 86400000; // 24 hours anti-flash-loan
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_LOAN_BORROWER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_LOAN_COLLATERAL = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_LOAN_DEBT = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_LOAN_ACTIVE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_LOAN_CREATED = new byte[] { 0x15 };
        #endregion

        #region Events
        [DisplayName("LoanCreated")]
        public static event LoanCreatedHandler OnLoanCreated;

        [DisplayName("LoanRepaid")]
        public static event LoanRepaidHandler OnLoanRepaid;

        [DisplayName("LoanClosed")]
        public static event LoanClosedHandler OnLoanClosed;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalLoans() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LOAN_ID);

        [Safe]
        public static BigInteger GetDebt(BigInteger loanId)
        {
            byte[] key = Helper.Concat(PREFIX_LOAN_DEBT, (ByteString)loanId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static UInt160 GetBorrower(BigInteger loanId)
        {
            byte[] key = Helper.Concat(PREFIX_LOAN_BORROWER, (ByteString)loanId.ToByteArray());
            return (UInt160)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetCollateral(BigInteger loanId)
        {
            byte[] key = Helper.Concat(PREFIX_LOAN_COLLATERAL, (ByteString)loanId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsActive(BigInteger loanId)
        {
            byte[] key = Helper.Concat(PREFIX_LOAN_ACTIVE, (ByteString)loanId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static Map<string, object> GetLoan(BigInteger loanId)
        {
            Map<string, object> loan = new Map<string, object>();
            loan["id"] = loanId;
            loan["borrower"] = GetBorrower(loanId);
            loan["collateral"] = GetCollateral(loanId);
            loan["debt"] = GetDebt(loanId);
            loan["active"] = IsActive(loanId);
            return loan;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, 0);
        }
        #endregion

        #region User Methods

        public static void CreateLoan(UInt160 borrower, BigInteger neoAmount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(neoAmount > 0, "invalid amount");
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "unauthorized");

            NEO.Transfer(borrower, Runtime.ExecutingScriptHash, neoAmount);

            BigInteger loanId = TotalLoans() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, loanId);

            // Calculate loan amount (20% of collateral value in GAS)
            BigInteger loanAmount = neoAmount * LTV_PERCENT * 100000000 / 100;

            byte[] borrowerKey = Helper.Concat(PREFIX_LOAN_BORROWER, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, borrowerKey, borrower);

            byte[] collateralKey = Helper.Concat(PREFIX_LOAN_COLLATERAL, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, collateralKey, neoAmount);

            byte[] debtKey = Helper.Concat(PREFIX_LOAN_DEBT, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, debtKey, loanAmount);

            byte[] activeKey = Helper.Concat(PREFIX_LOAN_ACTIVE, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 1);

            // SECURITY: Record loan creation time for anti-flash-loan
            byte[] createdKey = Helper.Concat(PREFIX_LOAN_CREATED, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, createdKey, Runtime.Time);

            // Transfer loan to borrower
            GAS.Transfer(Runtime.ExecutingScriptHash, borrower, loanAmount);

            OnLoanCreated(loanId, borrower, neoAmount, loanAmount);
        }

        public static void RepayDebt(BigInteger loanId, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);

            byte[] activeKey = Helper.Concat(PREFIX_LOAN_ACTIVE, (ByteString)loanId.ToByteArray());
            ExecutionEngine.Assert((BigInteger)Storage.Get(Storage.CurrentContext, activeKey) == 1, "loan not active");

            // SECURITY: Anti-flash-loan - enforce 24h minimum loan duration
            byte[] createdKey = Helper.Concat(PREFIX_LOAN_CREATED, (ByteString)loanId.ToByteArray());
            BigInteger createdTime = (BigInteger)Storage.Get(Storage.CurrentContext, createdKey);
            ExecutionEngine.Assert(Runtime.Time >= createdTime + MIN_LOAN_DURATION, "min 24h loan required");

            BigInteger currentDebt = GetDebt(loanId);
            BigInteger repayAmount = amount > currentDebt ? currentDebt : amount;

            byte[] debtKey = Helper.Concat(PREFIX_LOAN_DEBT, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, debtKey, currentDebt - repayAmount);

            OnLoanRepaid(loanId, repayAmount, currentDebt - repayAmount);

            // Check if fully repaid
            if (currentDebt - repayAmount == 0)
            {
                CloseLoan(loanId);
            }
        }

        private static void CloseLoan(BigInteger loanId)
        {
            byte[] borrowerKey = Helper.Concat(PREFIX_LOAN_BORROWER, (ByteString)loanId.ToByteArray());
            UInt160 borrower = (UInt160)Storage.Get(Storage.CurrentContext, borrowerKey);

            byte[] collateralKey = Helper.Concat(PREFIX_LOAN_COLLATERAL, (ByteString)loanId.ToByteArray());
            BigInteger collateral = (BigInteger)Storage.Get(Storage.CurrentContext, collateralKey);

            byte[] activeKey = Helper.Concat(PREFIX_LOAN_ACTIVE, (ByteString)loanId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 0);

            NEO.Transfer(Runtime.ExecutingScriptHash, borrower, collateral);

            OnLoanClosed(loanId, borrower);
        }

        #endregion
    }
}
