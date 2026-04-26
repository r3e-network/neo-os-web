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
        #region Lending Internal Helpers

        private static void StoreLoan(string appId, BigInteger loanId, Loan loan)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, PREFIX_LOANS, loanId),
                StdLib.Serialize(loan));
        }

        private static BigInteger GetLtvForTier(BigInteger tier)
        {
            ExecutionEngine.Assert(tier >= 1 && tier <= 3, "invalid LTV tier (1-3)");
            if (tier == 1) return LTV_TIER1_BPS;
            if (tier == 2) return LTV_TIER2_BPS;
            return LTV_TIER3_BPS;
        }

        private static void AddUserLoan(string appId, UInt160 user, BigInteger loanId)
        {
            ByteString countKey = AppKey(appId, PREFIX_USER_LOAN_COUNT, user);
            BigInteger count = GetBigInteger(countKey);
            Put(countKey, count + 1);

            ByteString key = AppKey(appId, PREFIX_USER_LOANS, count, user);
            Put(key, loanId);
        }

        private static void UpdateTotalCollateral(string appId, BigInteger amount, bool isDeposit)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_COLLATERAL);
            BigInteger total = GetBigInteger(key);
            Put(key, isDeposit ? total + amount : total - amount);
        }

        private static void UpdateTotalDebt(string appId, BigInteger amount, bool isIncrease)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_DEBT);
            BigInteger total = GetBigInteger(key);
            Put(key, isIncrease ? total + amount : total - amount);
        }

        private static void UpdateTotalRepaid(string appId, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_REPAID);
            BigInteger total = GetBigInteger(key);
            Put(key, total + amount);
        }

        #endregion

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

            // Transfer GAS loan to borrower
            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, borrower, netLoan);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");

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

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral),
                "collateral return failed");

            OnLoanClosed(appId, loanId, loan.Borrower);
        }

        #endregion

        #region ProfitAnchor Integration

        /// <summary>
        /// Configure the ProfitAnchor app that supplies the highest-profit
        /// candidate for SelfLoan collateral voting. This does not transfer
        /// collateral to ProfitAnchor.
        /// </summary>
        public static void SetProfitAnchor(string appId, UInt160 profitAnchorContract, string profitAnchorAppId)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);
            ValidateAddress(profitAnchorContract);
            ExecutionEngine.Assert(profitAnchorAppId != null && profitAnchorAppId.Length > 0, "profit appId required");

            PutAddress(AppKey(appId, PREFIX_PROFIT_ANCHOR_CONTRACT), profitAnchorContract);
            Put(AppKey(appId, PREFIX_PROFIT_ANCHOR_APP_ID), (ByteString)profitAnchorAppId!);

            OnProfitAnchorConfigured(appId, profitAnchorContract, profitAnchorAppId!);
        }

        /// <summary>
        /// Vote the SelfLoan contract's own NEO balance according to the
        /// ProfitAnchor best-candidate view. User collateral remains in
        /// SelfLoan custody and is still withdrawable only through loan close.
        /// </summary>
        public static void SyncProfitAnchorVote(string appId)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);

            UInt160 profitAnchorContract = GetProfitAnchorContract(appId);
            string profitAnchorAppId = GetProfitAnchorAppId(appId);
            ValidateAddress(profitAnchorContract);
            ExecutionEngine.Assert(profitAnchorAppId != null && profitAnchorAppId.Length > 0, "profit anchor not configured");

            ByteString candidate = (ByteString)Contract.Call(
                profitAnchorContract,
                "getBestCandidate",
                CallFlags.ReadStates,
                new object[] { profitAnchorAppId! })!;
            ExecutionEngine.Assert(candidate != null && candidate.Length == 33, "profit candidate missing");
            ExecutionEngine.Assert(NEO.Vote(Runtime.ExecutingScriptHash, (ECPoint)candidate!), "collateral vote failed");

            OnProfitAnchorVoteSynced(appId, profitAnchorContract, profitAnchorAppId!, candidate!);
        }

        [Safe]
        public static UInt160 GetProfitAnchorContract(string appId) =>
            ReadAddress(AppKey(appId, PREFIX_PROFIT_ANCHOR_CONTRACT));

        [Safe]
        public static string GetProfitAnchorAppId(string appId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_PROFIT_ANCHOR_APP_ID));
            return data == null ? "" : (string)data;
        }

        [Safe]
        public static Map<string, object> GetProfitAnchor(string appId)
        {
            Map<string, object> result = new Map<string, object>();
            UInt160 contractHash = GetProfitAnchorContract(appId);
            string profitAnchorAppId = GetProfitAnchorAppId(appId);
            result["contract"] = contractHash;
            result["appId"] = profitAnchorAppId;
            result["enabled"] = contractHash != UInt160.Zero && profitAnchorAppId.Length > 0;
            return result;
        }

        #endregion

        #region Lending Read Methods

        [Safe]
        public static Loan GetLoan(string appId, BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, PREFIX_LOANS, loanId));
            if (data == null) return new Loan();
            return (Loan)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetHealthFactor(string appId, BigInteger loanId)
        {
            Loan loan = GetLoan(appId, loanId);
            if (loan.Debt == 0) return 10000;
            return loan.Collateral * GAS_FIXED8 * 100 / loan.Debt;
        }

        [Safe]
        public static Map<string, object> GetLendingStats(string appId)
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalLoans"] = GetBigInteger(AppKey(appId, PREFIX_LOAN_ID));
            stats["totalCollateral"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_COLLATERAL));
            stats["totalDebt"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_DEBT));
            stats["totalRepaid"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_REPAID));
            stats["totalBorrowers"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_BORROWERS));
            stats["ltvTier1Bps"] = LTV_TIER1_BPS;
            stats["ltvTier2Bps"] = LTV_TIER2_BPS;
            stats["ltvTier3Bps"] = LTV_TIER3_BPS;
            stats["liquidationThresholdBps"] = LIQUIDATION_THRESHOLD_BPS;
            stats["minHealthFactor"] = MIN_HEALTH_FACTOR;
            stats["minCollateral"] = MIN_COLLATERAL;
            stats["lendingFeeBps"] = LENDING_FEE_BPS;
            stats["profitAnchor"] = GetProfitAnchor(appId);
            return stats;
        }

        #endregion
    }
}
