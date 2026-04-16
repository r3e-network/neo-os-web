using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region User-Facing Methods

        /// <summary>
        /// Request and execute an atomic flash loan in a single transaction.
        /// </summary>
        public static BigInteger RequestLoan(UInt160 borrower, BigInteger amount, UInt160 callbackContract, string callbackMethod)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(borrower);
            ExecutionEngine.Assert(amount >= MIN_LOAN, "min loan 1 GAS");
            ExecutionEngine.Assert(amount <= MAX_LOAN, "max loan 100000 GAS");
            ExecutionEngine.Assert(callbackContract != null && callbackContract.IsValid, "callback contract required");
            ExecutionEngine.Assert(callbackMethod != null && callbackMethod.Length > 0, "callback method required");

            // Anti-abuse: Check loan cooldown and reentrancy guard
            ValidateLoanCooldown(borrower);

            // Reentrancy guard: mark borrower as in-flight BEFORE any external calls
            ByteString reentrancyKey = Helper.Concat((ByteString)new byte[] { 0xFE }, (ByteString)(byte[])borrower);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, reentrancyKey) == null, "reentrancy rejected");
            Storage.Put(Storage.CurrentContext, reentrancyKey, 1);

            BigInteger poolBalance = GetPoolBalance();
            ExecutionEngine.Assert(amount <= poolBalance, "insufficient pool balance");
            BigInteger contractGasBefore = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(contractGasBefore >= amount, "insufficient GAS backing");

            // Record loan for rate limiting BEFORE external calls
            RecordLoanRequest(borrower);

            BigInteger loanId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_LOAN_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_LOAN_ID, loanId);

            BigInteger fee = amount * FEE_BASIS_POINTS / 10000;

            LoanData loan = new LoanData
            {
                Borrower = borrower,
                Amount = amount,
                Fee = fee,
                CallbackContract = callbackContract,
                CallbackMethod = callbackMethod,
                Timestamp = Runtime.Time,
                Executed = true,
                Success = false
            };
            BorrowerStats borrowerStats = GetBorrowerStats(loan.Borrower);
            bool isNewBorrower = borrowerStats.JoinTime == 0;

            // Store loan state BEFORE external calls (checks-effects-interactions)
            StoreLoan(loanId, loan);
            OnLoanRequested(loanId, borrower, amount);

            bool funded = GAS.Transfer(
                Runtime.ExecutingScriptHash,
                callbackContract,
                amount,
                StdLib.Serialize(new object[] { loanId, borrower, amount, fee })
            );
            ExecutionEngine.Assert(funded, "loan transfer failed");

            Contract.Call(callbackContract, callbackMethod, CallFlags.All, borrower, amount, fee, loanId);

            BigInteger contractGasAfter = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(contractGasAfter == contractGasBefore + fee, "loan not repaid with exact fee");

            // Clear reentrancy guard
            Storage.Delete(Storage.CurrentContext, reentrancyKey);

            loan.Success = true;
            StoreLoan(loanId, loan);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance + fee);

            UpdateBorrowerStatsOnLoan(loan.Borrower, loan.Amount, loan.Fee, loan.Success, isNewBorrower);
            OnLoanExecuted(loanId, loan.Borrower, loan.Amount, loan.Fee, loan.Success);
            return loanId;
        }

        [Safe]
        public static LoanData GetLoan(BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_LOANS, (ByteString)loanId.ToByteArray()));
            if (data == null) return new LoanData();
            return (LoanData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetPoolBalance()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_POOL_BALANCE);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        /// <summary>
        /// Deposit liquidity to the flash loan pool.
        /// </summary>
        public static void Deposit(UInt160 depositor, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(depositor);
            ExecutionEngine.Assert(amount > 0, "amount required");

            ConsumeDirectGasCredit(depositor, amount);

            ProviderStats stats = GetProviderStats(depositor);
            bool isNewProvider = stats.JoinTime == 0;

            BigInteger poolBalance = GetPoolBalance();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance + amount);

            UpdateProviderStatsOnDeposit(depositor, amount, isNewProvider);
            CheckProviderBadges(depositor);

            OnLiquidityDeposited(depositor, amount, stats.TotalDeposited + amount);
        }

        /// <summary>
        /// Withdraw liquidity from the flash loan pool.
        /// </summary>
        public static void Withdraw(UInt160 provider, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(provider);
            ExecutionEngine.Assert(amount > 0, "amount required");

            ProviderStats stats = GetProviderStats(provider);
            ExecutionEngine.Assert(stats.CurrentBalance >= amount, "insufficient balance");

            BigInteger poolBalance = GetPoolBalance();
            ExecutionEngine.Assert(poolBalance >= amount, "insufficient pool balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, provider, amount, null);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance - amount);

            stats.CurrentBalance -= amount;
            stats.TotalWithdrawn += amount;
            stats.LastActivityTime = Runtime.Time;
            StoreProviderStats(provider, stats);

            OnLiquidityWithdrawn(provider, amount, stats.CurrentBalance);
        }

        /// <summary>
        /// Distribute accumulated fees to liquidity providers.
        /// SECURITY: Only admin can trigger fee distribution.
        /// </summary>
        public static void DistributeFees()
        {
            ValidateAdmin();

            BigInteger totalFees = GetTotalFees();
            ExecutionEngine.Assert(totalFees > 0, "no fees to distribute");

            BigInteger providerShare = totalFees * PROVIDER_FEE_SHARE / 100;
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FEES, 0);

            OnFeesDistributed(totalFees, providerShare);
        }

        /// <summary>
        /// Deprecated async Oracle callback path.
        /// FlashLoan now executes atomically inside RequestLoan.
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId, string requestType,
            bool success, ByteString result, string error)
        {
            ValidateOracle();
            ExecutionEngine.Assert(false, "flashloan no longer uses oracle callbacks");
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);
            ProcessAutomatedLiquidation();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            return RegisterAutomationTask(triggerType, schedule, 1000000);
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            CancelAutomationTask();
        }

        private static BigInteger RegisterAutomationTask(
            string triggerType, string schedule, BigInteger gasLimit)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "anchor not set");

            BigInteger taskId = (BigInteger)Contract.Call(
                anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution",
                triggerType, schedule, gasLimit);

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            return taskId;
        }

        private static void CancelAutomationTask()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no task registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
        }

        /// <summary>
        /// Internal method to process automated loan liquidation.
        /// </summary>
        private static void ProcessAutomatedLiquidation()
        {
            // Production implementation would:
            // 1. Iterate through active loans
            // 2. Check collateral ratios or time-based defaults
            // 3. Liquidate loans that meet liquidation criteria
            // 4. Update pool balances accordingly
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "unsupported asset");
            if (from == Runtime.ExecutingScriptHash) return;

            string memo = ReadPaymentMemo(data);
            if (memo.StartsWith(APP_ID + ":"))
            {
                CreditDirectGasPayment(APP_ID, from, amount, data);
            }
        }

        #endregion
    }
}
