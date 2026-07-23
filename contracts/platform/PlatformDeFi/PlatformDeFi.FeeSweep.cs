using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    /// <summary>
    /// Admin sweep methods for retained protocol fees. Three subsystems retain
    /// fee revenue during their normal operation — without these sweeps the
    /// accumulated GAS would sit in the contract balance untracked / un-claimable
    /// (and only recoverable via a full contract Update).
    ///
    ///   • Lending: LENDING_FEE_BPS portion of every loan origination, tracked
    ///     in PREFIX_TOTAL_LENDING_FEES (incremented in CreateLoan).
    ///   • Capsule: CAPSULE_FEE_BPS portion of compound yield at unlock, tracked
    ///     in PREFIX_TOTAL_CAPSULE_FEES (incremented in UnlockCapsule).
    ///   • FlashLoan: FLASH_FEE_BPS portion of every loan, added to pool balance.
    ///     The unclaimed portion = poolBalance − sum-of-LP-deposits (per audit
    ///     fix C-1 invariant). Sweep recomputes available from the invariant
    ///     rather than maintaining a separate counter.
    ///
    /// Each sweep follows checks-effects-interactions: counter (or pool delta)
    /// is updated before the GAS.Transfer so a re-entrant GAS contract cannot
    /// drain twice.
    /// </summary>
    public partial class PlatformDeFiContract
    {
        public delegate void LendingFeesWithdrawnHandler(string appId, UInt160 to, BigInteger amount);
        public delegate void CapsuleFeesWithdrawnHandler(string appId, UInt160 to, BigInteger amount);
        public delegate void FlashLoanFeesWithdrawnHandler(string appId, UInt160 to, BigInteger amount);

        [DisplayName("LendingFeesWithdrawn")]
        public static event LendingFeesWithdrawnHandler OnLendingFeesWithdrawn;
        [DisplayName("CapsuleFeesWithdrawn")]
        public static event CapsuleFeesWithdrawnHandler OnCapsuleFeesWithdrawn;
        [DisplayName("FlashLoanFeesWithdrawn")]
        public static event FlashLoanFeesWithdrawnHandler OnFlashLoanFeesWithdrawn;

        public static void WithdrawLendingFees(string appId, UInt160 to)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);

            ByteString feeKey = AppKey(appId, PREFIX_TOTAL_LENDING_FEES);
            BigInteger amount = GetBigInteger(feeKey);
            ExecutionEngine.Assert(amount > 0, "no lending fees");

            Put(feeKey, 0);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "lending fee transfer failed");
            EnsureGasCreditSolvent();

            OnLendingFeesWithdrawn(appId, to, amount);
        }

        [Safe]
        public static BigInteger GetTotalLendingFees(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_TOTAL_LENDING_FEES));

        public static void WithdrawCapsuleFees(string appId, UInt160 to)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);

            ByteString feeKey = AppKey(appId, PREFIX_TOTAL_CAPSULE_FEES);
            BigInteger amount = GetBigInteger(feeKey);
            ExecutionEngine.Assert(amount > 0, "no capsule fees");

            Put(feeKey, 0);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "capsule fee transfer failed");
            EnsureGasCreditSolvent();

            OnCapsuleFeesWithdrawn(appId, to, amount);
        }

        [Safe]
        public static BigInteger GetTotalCapsuleFees(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_TOTAL_CAPSULE_FEES));

        public static void WithdrawFlashLoanFees(string appId, UInt160 to)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);

            ByteString poolKey = AppKey(appId, PREFIX_POOL_BALANCE);
            ByteString lpKey = AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS);
            BigInteger poolBalance = GetBigInteger(poolKey);
            BigInteger lpDeposits = GetBigInteger(lpKey);
            ExecutionEngine.Assert(poolBalance >= lpDeposits, "pool invariant violated");

            BigInteger amount = poolBalance - lpDeposits;
            ExecutionEngine.Assert(amount > 0, "no flash loan fees");

            // Decrement pool balance to keep the invariant
            //   poolBalance == lpDeposits + (unclaimed fees)
            // intact after the sweep.
            Put(poolKey, lpDeposits);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "flash loan fee transfer failed");
            EnsureGasCreditSolvent();

            OnFlashLoanFeesWithdrawn(appId, to, amount);
        }

        [Safe]
        public static BigInteger GetUnclaimedFlashLoanFees(string appId)
        {
            BigInteger poolBalance = GetBigInteger(AppKey(appId, PREFIX_POOL_BALANCE));
            BigInteger lpDeposits = GetBigInteger(AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS));
            return poolBalance >= lpDeposits ? poolBalance - lpDeposits : 0;
        }
    }
}
