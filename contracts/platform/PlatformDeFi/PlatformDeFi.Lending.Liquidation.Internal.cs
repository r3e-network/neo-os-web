using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    /// <summary>
    /// Audit fix FixV (PlatformDeFi lending liquidation) — internal helpers split out of
    /// PlatformDeFi.Lending.Liquidation.cs to keep each partial under the 300-line
    /// reviewability budget. Contains the partial-seizure math and the surplus-credit
    /// helper used by <see cref="PlatformDeFiContract.LiquidateLoan"/>.
    /// </summary>
    public partial class PlatformDeFiContract
    {
        /// <summary>
        /// NEO collateral (whole units) the liquidator must seize to cover a GAS debt plus the
        /// bounded liquidation bonus, at the supplied NEO/GAS price (GAS FIXED8 per 1 NEO).
        ///
        /// The GAS value to cover is debt * (10000 + LIQUIDATION_BONUS_BPS) / 10000. NEO is an
        /// integer token, so the required NEO count is the CEILING of (coverValue / price) to
        /// guarantee the seized collateral is worth at least the debt + bonus (never rounding
        /// the liquidator short). The caller caps the result at the loan's actual collateral.
        /// </summary>
        private static BigInteger SeizeCollateralForDebt(BigInteger debt, BigInteger neoPrice)
        {
            ExecutionEngine.Assert(neoPrice > 0, "invalid price");
            BigInteger coverValue = debt * (10000 + LIQUIDATION_BONUS_BPS) / 10000;
            // Ceiling division: (a + b - 1) / b for positive operands.
            BigInteger seizeNeo = (coverValue + neoPrice - 1) / neoPrice;
            return seizeNeo;
        }

        /// <summary>
        /// Credit NEO back to a borrower's prepaid-NEO ledger (the same ledger funded via
        /// OnNEP17Payment and reclaimable via WithdrawNeoCredit). Used to return surplus
        /// collateral after a partial-seizure liquidation without sending NEO inside the
        /// liquidation call, keeping checks-effects-interactions clean.
        /// </summary>
        private static void CreditNeoToBorrower(UInt160 borrower, BigInteger amount)
        {
            if (amount <= 0) return;
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString key = (ByteString)(byte[])borrower;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }
    }
}
