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
    /// Audit fixes A9 / A10 / A12 - per-product GAS liquidity segregation.
    ///
    /// A single deployed PlatformDeFi contract hosts Lending, FlashLoan and Capsule
    /// products that all keep GAS in the contract's ONE native GAS balance. Before
    /// this fix, a lending disbursement (A12, unbacked) or a capsule compound payout
    /// (A9, unfunded) could spend GAS that actually belonged to FlashLoan LPs,
    /// stranding their principal (A10).
    ///
    /// The fix gives Lending and Capsule each their own tracked GAS pool, funded by
    /// an explicit deposit path, and asserts every disbursement is covered by - and
    /// decrements - that product's own counter. No product can spend another's GAS.
    /// </summary>
    public partial class PlatformDeFiContract
    {
        public delegate void LendingLiquidityChangedHandler(string appId, BigInteger amount, BigInteger newTotal);
        public delegate void CapsuleReserveChangedHandler(string appId, BigInteger amount, BigInteger newTotal);

        [DisplayName("LendingLiquidityDeposited")]
        public static event LendingLiquidityChangedHandler OnLendingLiquidityDeposited;
        [DisplayName("LendingLiquidityWithdrawn")]
        public static event LendingLiquidityChangedHandler OnLendingLiquidityWithdrawn;
        [DisplayName("CapsuleYieldReserveFunded")]
        public static event CapsuleReserveChangedHandler OnCapsuleYieldReserveFunded;
        [DisplayName("CapsuleYieldReserveWithdrawn")]
        public static event CapsuleReserveChangedHandler OnCapsuleYieldReserveWithdrawn;

        #region Lending GAS Liquidity (A10 / A12)

        [Safe]
        public static BigInteger GetLendingLiquidity(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_LENDING_GAS_LIQUIDITY));

        /// <summary>
        /// Fund the lending product's GAS liquidity pool. The funder must have
        /// pre-deposited GAS via OnNEP17Payment. Loans are disbursed only from this
        /// pool (audit fix A12) so lending can never spend FlashLoan LP GAS (A10).
        /// </summary>
        public static void LendingDeposit(string appId, UInt160 funder, BigInteger amount)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAddress(funder);
            ExecutionEngine.Assert(Runtime.CheckWitness(funder), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ConsumeGasCredit(funder, amount);

            ByteString key = AppKey(appId, PREFIX_LENDING_GAS_LIQUIDITY);
            BigInteger total = GetBigInteger(key) + amount;
            Put(key, total);
            OnLendingLiquidityDeposited(appId, amount, total);
        }

        /// <summary>Decrement the lending GAS pool on disbursement; asserts coverage (A12).</summary>
        private static void DrawLendingLiquidity(string appId, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_LENDING_GAS_LIQUIDITY);
            BigInteger total = GetBigInteger(key);
            ExecutionEngine.Assert(total >= amount, "insufficient lending liquidity");
            Put(key, total - amount);
        }

        /// <summary>Increment the lending GAS pool when debt is repaid / liquidated.</summary>
        private static void RefillLendingLiquidity(string appId, BigInteger amount)
        {
            if (amount <= 0) return;
            ByteString key = AppKey(appId, PREFIX_LENDING_GAS_LIQUIDITY);
            Put(key, GetBigInteger(key) + amount);
        }

        /// <summary>
        /// App / platform admin reclaims surplus lending GAS liquidity. Bounded by
        /// the tracked counter so this can never pull GAS owed to other products.
        /// Checks-effects-interactions: counter is debited before the transfer.
        /// </summary>
        public static void WithdrawLendingLiquidity(string appId, UInt160 to, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);
            ExecutionEngine.Assert(amount > 0, "amount required");

            DrawLendingLiquidity(appId, amount);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "lending liquidity transfer failed");
            OnLendingLiquidityWithdrawn(appId, amount, GetLendingLiquidity(appId));
        }

        #endregion

        #region Capsule GAS Yield Reserve (A9 / A10)

        [Safe]
        public static BigInteger GetCapsuleYieldReserve(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_CAPSULE_GAS_RESERVE));

        /// <summary>
        /// Fund the capsule product's GAS compound-yield reserve. The funder must
        /// have pre-deposited GAS via OnNEP17Payment. Compound yield paid at unlock
        /// is drawn from - and asserted against - this reserve (audit fix A9) so it
        /// is never paid from FlashLoan LP principal or lending liquidity (A10).
        /// </summary>
        public static void FundCapsuleYieldReserve(string appId, UInt160 funder, BigInteger amount)
        {
            ValidateApp(appId, ProductType_Capsule);
            ValidateAddress(funder);
            ExecutionEngine.Assert(Runtime.CheckWitness(funder), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount required");

            ConsumeGasCredit(funder, amount);

            ByteString key = AppKey(appId, PREFIX_CAPSULE_GAS_RESERVE);
            BigInteger total = GetBigInteger(key) + amount;
            Put(key, total);
            OnCapsuleYieldReserveFunded(appId, amount, total);
        }

        /// <summary>Decrement the capsule yield reserve on compound payout; asserts coverage (A9).</summary>
        private static void DrawCapsuleYieldReserve(string appId, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_CAPSULE_GAS_RESERVE);
            BigInteger total = GetBigInteger(key);
            ExecutionEngine.Assert(total >= amount, "insufficient capsule yield reserve");
            Put(key, total - amount);
        }

        /// <summary>
        /// App / platform admin reclaims surplus capsule yield reserve. Bounded by
        /// the tracked counter so it can never pull GAS owed to other products.
        /// Checks-effects-interactions: counter is debited before the transfer.
        /// </summary>
        public static void WithdrawCapsuleYieldReserve(string appId, UInt160 to, BigInteger amount)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);
            ExecutionEngine.Assert(amount > 0, "amount required");

            DrawCapsuleYieldReserve(appId, amount);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "capsule yield reserve transfer failed");
            OnCapsuleYieldReserveWithdrawn(appId, amount, GetCapsuleYieldReserve(appId));
        }

        #endregion
    }
}
