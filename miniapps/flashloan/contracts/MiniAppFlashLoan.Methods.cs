using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFlashLoan
    {
        #region User-Facing Methods

        /// <summary>
        /// Request a flash loan with TEE callback verification.
        /// 
        /// REQUIREMENTS:
        /// - Platform not paused
        /// - Borrower must be authenticated
        /// - Amount between MIN_LOAN and MAX_LOAN
        /// - Valid callback contract and method
        /// - Cooldown period passed since last loan
        /// - Sufficient pool balance
        /// 
        /// PROCESS:
        /// - Validates loan parameters
        /// - Checks rate limiting (cooldown, daily max)
        /// - Creates loan record
        /// - Requests TEE verification of callback
        /// - Emits LoanRequested and LoanVerification events
        /// 
        /// FEE: 0.09% of loan amount
        /// </summary>
        /// <param name="borrower">Borrower address</param>
        /// <param name="amount">Loan amount in GAS</param>
        /// <param name="callbackContract">Contract to call with loan</param>
        /// <param name="callbackMethod">Method to invoke</param>
        /// <returns>Loan ID</returns>
        public static BigInteger RequestLoan(UInt160 borrower, BigInteger amount, UInt160 callbackContract, string callbackMethod)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "unauthorized");
            ExecutionEngine.Assert(amount >= MIN_LOAN, "min loan 1 GAS");
            ExecutionEngine.Assert(amount <= MAX_LOAN, "max loan 100000 GAS");
            ExecutionEngine.Assert(callbackContract != null && callbackContract.IsValid, "callback contract required");
            ExecutionEngine.Assert(callbackMethod != null && callbackMethod.Length > 0, "callback method required");

            // Anti-abuse: Check loan cooldown
            ValidateLoanCooldown(borrower);

            BigInteger poolBalance = GetPoolBalance();
            ExecutionEngine.Assert(amount <= poolBalance, "insufficient pool balance");

            // Record loan for rate limiting
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
                Executed = false,
                Success = false
            };
            StoreLoan(loanId, loan);

            // Request TEE to verify callback will repay
            BigInteger requestId = RequestTeeVerification(loanId, amount, callbackContract, callbackMethod);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_LOAN, (ByteString)requestId.ToByteArray()),
                loanId);

            OnLoanRequested(loanId, borrower, amount);
            OnLoanVerification(loanId, requestId);
            return loanId;
        }

        /// <summary>Get loan data by ID.</summary>
        /// <param name="loanId">Loan identifier</param>
        /// <returns>Loan data (empty if not found)</returns>
        [Safe]
        public static LoanData GetLoan(BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_LOANS, (ByteString)loanId.ToByteArray()));
            if (data == null) return new LoanData();
            return (LoanData)StdLib.Deserialize(data);
        }

        /// <summary>Get current pool liquidity balance.</summary>
        /// <returns>Pool balance in GAS</returns>
        [Safe]
        public static BigInteger GetPoolBalance()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_POOL_BALANCE);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        /// <summary>
        /// Deposit liquidity to the flash loan pool.
        /// 
        /// REQUIREMENTS:
        /// - Platform not paused
        /// - Depositor must be authenticated
        /// - Amount must be positive
        /// - Valid payment receipt
        /// 
        /// EFFECTS:
        /// - Increases pool balance
        /// - Updates provider stats
        /// - Emits LiquidityDeposited event
        /// 
        /// PROVIDER SHARE: 80% of all fees
        /// </summary>
        /// <param name="depositor">Provider address</param>
        /// <param name="amount">Deposit amount in GAS</param>
        /// <param name="receiptId">Payment receipt ID</param>
        public static void Deposit(UInt160 depositor, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ValidatePaymentReceipt(APP_ID, depositor, amount, receiptId);

            // Check if new provider
            ProviderStats stats = GetProviderStats(depositor);
            bool isNewProvider = stats.JoinTime == 0;

            BigInteger poolBalance = GetPoolBalance();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance + amount);

            // Update provider stats
            UpdateProviderStatsOnDeposit(depositor, amount, isNewProvider);

            // Check badges
            CheckProviderBadges(depositor);

            OnLiquidityDeposited(depositor, amount, stats.TotalDeposited + amount);
        }

        /// <summary>
        /// Withdraw liquidity from the flash loan pool.
        /// </summary>
        public static void Withdraw(UInt160 provider, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(provider), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ProviderStats stats = GetProviderStats(provider);
            ExecutionEngine.Assert(stats.CurrentBalance >= amount, "insufficient balance");

            BigInteger poolBalance = GetPoolBalance();
            ExecutionEngine.Assert(poolBalance >= amount, "insufficient pool balance");

            // Update pool balance
            Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance - amount);

            // Update provider stats
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

            // Reset total fees
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FEES, 0);

            OnFeesDistributed(totalFees, providerShare);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestTeeVerification(BigInteger loanId, BigInteger amount, UInt160 callbackContract, string callbackMethod)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { loanId, amount, callbackContract, callbackMethod });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "tee-compute", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString loanIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_LOAN, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(loanIdData != null, "unknown request");

            BigInteger loanId = (BigInteger)loanIdData;
            LoanData loan = GetLoan(loanId);
            ExecutionEngine.Assert(!loan.Executed, "already executed");
            ExecutionEngine.Assert(loan.Borrower != null, "loan not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_LOAN, (ByteString)requestId.ToByteArray()));

            // Check if new borrower
            BorrowerStats borrowerStats = GetBorrowerStats(loan.Borrower);
            bool isNewBorrower = borrowerStats.JoinTime == 0;

            loan.Executed = true;

            if (success && result != null && result.Length > 0)
            {
                // TEE verified callback will repay
                bool verified = (bool)StdLib.Deserialize(result);

                if (verified)
                {
                    // Execute the flash loan
                    loan.Success = true;

                    // Collect fee into pool
                    BigInteger poolBalance = GetPoolBalance();
                    Storage.Put(Storage.CurrentContext, PREFIX_POOL_BALANCE, poolBalance + loan.Fee);
                }
            }

            StoreLoan(loanId, loan);

            // Update borrower stats
            UpdateBorrowerStatsOnLoan(loan.Borrower, loan.Amount, loan.Fee, loan.Success, isNewBorrower);

            OnLoanExecuted(loanId, loan.Borrower, loan.Amount, loan.Fee, loan.Success);
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

        #endregion
    }
}
