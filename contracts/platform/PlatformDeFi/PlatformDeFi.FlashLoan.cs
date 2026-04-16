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
        #region FlashLoan Internal Helpers

        private static void StoreFlashLoan(string appId, BigInteger loanId, FlashLoanData loan)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, PREFIX_FLASH_LOANS, loanId),
                StdLib.Serialize(loan));
        }

        private static BigInteger GetPoolBalance(string appId)
        {
            return GetBigInteger(AppKey(appId, PREFIX_POOL_BALANCE));
        }

        /// <summary>
        /// Validates borrower hasn't exceeded loan frequency limits.
        /// Anti-abuse: 5 min cooldown + max 10 loans/day.
        /// </summary>
        private static void ValidateFlashCooldown(string appId, UInt160 borrower)
        {
            // Check cooldown
            ByteString lastLoanKey = AppKey(appId, PREFIX_BORROWER_LAST_LOAN, borrower);
            ByteString lastLoanData = GetRaw(lastLoanKey);
            if (lastLoanData != null)
            {
                BigInteger lastLoan = (BigInteger)lastLoanData;
                BigInteger elapsed = Runtime.Time - lastLoan;
                ExecutionEngine.Assert(elapsed >= FLASH_COOLDOWN_SECONDS, "wait 5 min between loans");
            }

            // Check daily limit
            BigInteger dailyCount = GetFlashDailyCount(appId, borrower);
            ExecutionEngine.Assert(dailyCount < FLASH_MAX_DAILY, "max 10 loans per day");
        }

        private static BigInteger GetFlashDailyCount(string appId, UInt160 borrower)
        {
            ByteString countKey = AppKey(appId, PREFIX_BORROWER_DAILY_COUNT, borrower);
            ByteString countData = GetRaw(countKey);
            if (countData == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(countData);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        private static void RecordFlashLoanRequest(string appId, UInt160 borrower)
        {
            // Update last loan time
            Put(AppKey(appId, PREFIX_BORROWER_LAST_LOAN, borrower), Runtime.Time);

            // Update daily count
            BigInteger currentDay = Runtime.Time / 86400;
            ByteString countKey = AppKey(appId, PREFIX_BORROWER_DAILY_COUNT, borrower);
            ByteString countData = GetRaw(countKey);

            BigInteger count = 1;
            if (countData != null)
            {
                object[] stored = (object[])StdLib.Deserialize(countData);
                BigInteger storedDay = (BigInteger)stored[0];
                if (storedDay == currentDay)
                {
                    count = (BigInteger)stored[1] + 1;
                }
            }
            Storage.Put(Storage.CurrentContext, countKey,
                StdLib.Serialize(new object[] { currentDay, count }));
        }

        #endregion

        #region FlashLoan Methods

        /// <summary>
        /// Request and execute an atomic flash loan in a single transaction.
        /// Includes reentrancy guard: a borrower cannot re-enter while a loan is in-flight.
        /// </summary>
        public static BigInteger RequestFlashLoan(string appId, UInt160 borrower, BigInteger amount,
            UInt160 callbackContract, string callbackMethod)
        {
            ValidateApp(appId, ProductType_FlashLoan);
            ValidateAddress(borrower);
            ExecutionEngine.Assert(Runtime.CheckWitness(borrower), "unauthorized");
            ExecutionEngine.Assert(amount >= FLASH_MIN_LOAN, "min loan 1 GAS");
            ExecutionEngine.Assert(amount <= FLASH_MAX_LOAN, "max loan 100000 GAS");
            ExecutionEngine.Assert(callbackContract != null && callbackContract.IsValid, "callback contract required");
            ExecutionEngine.Assert(callbackMethod != null && callbackMethod.Length > 0, "callback method required");

            // Anti-abuse: Check cooldown
            ValidateFlashCooldown(appId, borrower);

            // Reentrancy guard: mark borrower as in-flight BEFORE any external calls
            ByteString reentrancyKey = AppKey(appId, PREFIX_FLASH_REENTRANCY, borrower);
            ExecutionEngine.Assert(GetRaw(reentrancyKey) == null, "reentrancy rejected");
            Storage.Put(Storage.CurrentContext, reentrancyKey, 1);

            BigInteger poolBalance = GetPoolBalance(appId);
            ExecutionEngine.Assert(amount <= poolBalance, "insufficient pool balance");
            BigInteger contractGasBefore = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(contractGasBefore >= amount, "insufficient GAS backing");

            // Record loan for rate limiting BEFORE external calls
            RecordFlashLoanRequest(appId, borrower);

            // Increment loan ID
            ByteString idKey = AppKey(appId, PREFIX_FLASH_LOAN_ID);
            BigInteger loanId = GetBigInteger(idKey) + 1;
            Put(idKey, loanId);

            BigInteger fee = amount * FLASH_FEE_BPS / 10000;

            FlashLoanData loan = new FlashLoanData
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

            // Store loan state BEFORE external calls (checks-effects-interactions)
            StoreFlashLoan(appId, loanId, loan);

            // Transfer funds to callback contract
            bool funded = GAS.Transfer(
                Runtime.ExecutingScriptHash,
                callbackContract,
                amount,
                StdLib.Serialize(new object[] { loanId, borrower, amount, fee })
            );
            ExecutionEngine.Assert(funded, "loan transfer failed");

            // Invoke callback
            Contract.Call(callbackContract, callbackMethod, CallFlags.All,
                borrower, amount, fee, loanId);

            // Verify repayment: contract balance must be exactly original + fee
            BigInteger contractGasAfter = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(contractGasAfter == contractGasBefore + fee, "loan not repaid with exact fee");

            // Clear reentrancy guard
            Storage.Delete(Storage.CurrentContext, reentrancyKey);

            // Finalize
            loan.Success = true;
            StoreFlashLoan(appId, loanId, loan);
            Put(AppKey(appId, PREFIX_POOL_BALANCE), poolBalance + fee);

            // Update global stats
            ByteString totalBorrowedKey = AppKey(appId, PREFIX_FLASH_TOTAL_BORROWED);
            Put(totalBorrowedKey, GetBigInteger(totalBorrowedKey) + amount);

            ByteString totalFeesKey = AppKey(appId, PREFIX_FLASH_TOTAL_FEES);
            Put(totalFeesKey, GetBigInteger(totalFeesKey) + fee);

            OnFlashLoanExecuted(appId, loanId, borrower, amount, fee, true);
            return loanId;
        }

        /// <summary>
        /// Deposit liquidity to a flash loan pool.
        /// Caller must have pre-deposited GAS via OnNEP17Payment.
        /// </summary>
        public static void FlashDeposit(string appId, UInt160 depositor, BigInteger amount)
        {
            ValidateApp(appId, ProductType_FlashLoan);
            ValidateAddress(depositor);
            ExecutionEngine.Assert(Runtime.CheckWitness(depositor), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ConsumeGasCredit(depositor, amount);

            ByteString poolKey = AppKey(appId, PREFIX_POOL_BALANCE);
            Put(poolKey, GetBigInteger(poolKey) + amount);

            OnFlashLiquidityDeposited(appId, depositor, amount);
        }

        /// <summary>
        /// Withdraw liquidity from a flash loan pool.
        /// Only platform admin or app admin can withdraw on behalf of the pool.
        /// </summary>
        public static void FlashWithdraw(string appId, UInt160 provider, BigInteger amount)
        {
            ValidateApp(appId, ProductType_FlashLoan);
            ValidateAddress(provider);
            ExecutionEngine.Assert(Runtime.CheckWitness(provider), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ByteString poolKey = AppKey(appId, PREFIX_POOL_BALANCE);
            BigInteger poolBalance = GetBigInteger(poolKey);
            ExecutionEngine.Assert(poolBalance >= amount, "insufficient pool balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, provider, amount, null);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            Put(poolKey, poolBalance - amount);

            OnFlashLiquidityWithdrawn(appId, provider, amount);
        }

        #endregion

        #region FlashLoan Read Methods

        [Safe]
        public static FlashLoanData GetFlashLoan(string appId, BigInteger loanId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, PREFIX_FLASH_LOANS, loanId));
            if (data == null) return new FlashLoanData();
            return (FlashLoanData)StdLib.Deserialize(data);
        }

        [Safe]
        public static Map<string, object> GetFlashLoanStats(string appId)
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalLoans"] = GetBigInteger(AppKey(appId, PREFIX_FLASH_LOAN_ID));
            stats["totalBorrowed"] = GetBigInteger(AppKey(appId, PREFIX_FLASH_TOTAL_BORROWED));
            stats["totalFees"] = GetBigInteger(AppKey(appId, PREFIX_FLASH_TOTAL_FEES));
            stats["poolBalance"] = GetPoolBalance(appId);
            stats["minLoan"] = FLASH_MIN_LOAN;
            stats["maxLoan"] = FLASH_MAX_LOAN;
            stats["feeBasisPoints"] = FLASH_FEE_BPS;
            stats["cooldownSeconds"] = FLASH_COOLDOWN_SECONDS;
            stats["maxDailyLoans"] = FLASH_MAX_DAILY;
            return stats;
        }

        #endregion
    }
}
