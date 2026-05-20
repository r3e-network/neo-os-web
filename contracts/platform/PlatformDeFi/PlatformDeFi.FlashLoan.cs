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
                // Runtime.Time is BLOCK TIMESTAMP IN MILLISECONDS on Neo N3.
                // FLASH_COOLDOWN_MS already stores the 5-minute interval in ms
                // (audit fix NEW-L-2 renamed the constant from FLASH_COOLDOWN_SECONDS
                // and dropped the *1000 multiplier at the use site).
                ExecutionEngine.Assert(elapsed >= FLASH_COOLDOWN_MS, "wait 5 min between loans");
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
            // Runtime.Time is ms; 86400000 ms = 1 day. Previously divided by 86400
            // (seconds-per-day) and the resulting "day index" was 1000x too large,
            // so the daily limit reset every block.
            BigInteger currentDay = Runtime.Time / 86400000;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        private static void RecordFlashLoanRequest(string appId, UInt160 borrower)
        {
            // Update last loan time
            Put(AppKey(appId, PREFIX_BORROWER_LAST_LOAN, borrower), Runtime.Time);

            // Update daily count — see GetFlashDailyCount for the 86400000 (ms/day)
            // rationale.
            BigInteger currentDay = Runtime.Time / 86400000;
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
            ExecutionEngine.Assert(callbackMethod == "onFlashLoan", "callback method must be onFlashLoan");

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

            // Audit fix M-1: previously invoked with CallFlags.All, giving the
            // borrower-controlled callback full storage / call / witness rights under
            // the platform's witness. Restrict to AllowCall (the callback may call
            // other contracts, e.g. to swap and repay) and AllowNotify (so it can emit
            // events). It can no longer write to platform storage directly, eliminating
            // a class of cross-tenant griefing vectors.
            Contract.Call(callbackContract, callbackMethod, CallFlags.AllowCall | CallFlags.AllowNotify,
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
        /// Deposit liquidity to a flash loan pool. Each depositor's share is tracked
        /// individually so they can withdraw only what they put in (audit fix C-1).
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

            ByteString providerKey = AppKey(appId, PREFIX_FLASH_PROVIDER_BAL, depositor);
            Put(providerKey, GetBigInteger(providerKey) + amount);

            // Track total LP-owned principal separately from the pool balance so
            // off-chain monitors (and any future fee-claim flow) can compute
            // accumulated fees as poolBalance - totalLpDeposits without having to
            // iterate every per-LP key.
            ByteString totalLpKey = AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS);
            Put(totalLpKey, GetBigInteger(totalLpKey) + amount);

            OnFlashLiquidityDeposited(appId, depositor, amount);
        }

        /// <summary>
        /// Withdraw liquidity from a flash loan pool. A provider can only withdraw
        /// up to the amount they previously deposited via <see cref="FlashDeposit"/>
        /// (audit fix C-1 — prior version had no per-LP accounting, allowing any
        /// caller to drain the pool).
        /// </summary>
        public static void FlashWithdraw(string appId, UInt160 provider, BigInteger amount)
        {
            ValidateApp(appId, ProductType_FlashLoan);
            ValidateAddress(provider);
            ExecutionEngine.Assert(Runtime.CheckWitness(provider), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ByteString providerKey = AppKey(appId, PREFIX_FLASH_PROVIDER_BAL, provider);
            BigInteger providerBalance = GetBigInteger(providerKey);
            ExecutionEngine.Assert(providerBalance >= amount, "insufficient provider deposit");

            ByteString poolKey = AppKey(appId, PREFIX_POOL_BALANCE);
            BigInteger poolBalance = GetBigInteger(poolKey);
            ExecutionEngine.Assert(poolBalance >= amount, "insufficient pool balance");

            BigInteger nextProvider = providerBalance - amount;
            if (nextProvider == 0) Delete(providerKey);
            else Put(providerKey, nextProvider);
            Put(poolKey, poolBalance - amount);

            // Keep the LP-deposits accumulator consistent with the per-LP map.
            ByteString totalLpKey = AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS);
            Put(totalLpKey, GetBigInteger(totalLpKey) - amount);

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, provider, amount, null);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            OnFlashLiquidityWithdrawn(appId, provider, amount);
        }

        // Audit fix C-1: per-LP accessors and the one-time MigrateFlashProviderBalance
        // admin hook moved to PlatformDeFi.FlashLoan.Migration.cs so this partial
        // stays under the 300-line reviewability budget.

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
            stats["cooldownMs"] = FLASH_COOLDOWN_MS;
            stats["maxDailyLoans"] = FLASH_MAX_DAILY;
            return stats;
        }

        #endregion
    }
}
