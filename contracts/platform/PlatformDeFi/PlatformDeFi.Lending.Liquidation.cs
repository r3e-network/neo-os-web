using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    /// <summary>
    /// Audit fix H-3 (lending backing): collateral is now valued with a push-oracle / keeper
    /// price (GAS per 1 NEO) instead of the implicit 1 NEO = 1 GAS assumption, and undercollateralized
    /// loans can be liquidated. Together these stop the lending pool from being structurally
    /// under-backed: when NEO depreciates against GAS the health factor falls and any party can
    /// repay the loan's GAS debt to seize the NEO collateral, keeping the GAS pool whole.
    ///
    /// Remaining design item (tracked separately): the loan GAS is still paid from the contract's
    /// shared GAS balance rather than a lending-segregated pool — per-product solvency segregation
    /// belongs with the M-1 cross-tenant accounting work and is not addressed here.
    /// </summary>
    public partial class PlatformDeFiContract
    {
        #region Collateral Pricing

        /// <summary>
        /// NEO price expressed as GAS (FIXED8) per 1 NEO. Unset defaults to 1 NEO = 1 GAS so the
        /// pre-oracle behavior is preserved until a keeper pushes a live price.
        /// </summary>
        [Safe]
        public static BigInteger GetNeoGasPrice(string appId)
        {
            BigInteger price = GetBigInteger(AppKey(appId, PREFIX_NEO_GAS_PRICE));
            return price > 0 ? price : GAS_FIXED8;
        }

        /// <summary>
        /// Push the live NEO/GAS price. Authority-gated (platform admin or app admin) — the same
        /// trust model as an oracle updater. Pricing in GAS-per-NEO (FIXED8) lets the lending math
        /// stay in GAS units end to end.
        /// </summary>
        public static void SetNeoGasPrice(string appId, BigInteger price)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(price > 0, "price must be positive");

            Put(AppKey(appId, PREFIX_NEO_GAS_PRICE), price);
            OnNeoGasPriceUpdated(appId, price);
        }

        /// <summary>GAS (FIXED8) value of a NEO collateral amount at the current price.</summary>
        private static BigInteger CollateralValueGas(string appId, BigInteger collateralNeo)
        {
            return collateralNeo * GetNeoGasPrice(appId);
        }

        #endregion

        #region Liquidation

        /// <summary>
        /// Liquidate an undercollateralized loan. Open to any caller (a liquidator/keeper) who has
        /// pre-deposited enough GAS credit to cover the loan's outstanding debt. The loan is only
        /// liquidatable once the priced collateral value drops below the liquidation threshold of
        /// the debt (LIQUIDATION_THRESHOLD_BPS). The liquidator's GAS credit repays the debt in
        /// full (restoring the GAS pool) and the NEO collateral is transferred to the liquidator,
        /// whose profit is the spread between the collateral value and the debt — the standard
        /// incentive that keeps the book solvent without trusting the borrower to repay.
        ///
        /// Checks-effects-interactions: the GAS credit is consumed and the loan is closed before
        /// the NEO collateral leaves the contract, so a re-entrant token cannot double-seize.
        /// </summary>
        public static void LiquidateLoan(string appId, BigInteger loanId, UInt160 liquidator)
        {
            ValidateApp(appId, ProductType_Lending);
            ExecutionEngine.Assert(Runtime.CheckWitness(liquidator), "unauthorized");
            ValidateAddress(liquidator);

            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(loan.Debt > 0, "no outstanding debt");

            // Keep the yield/accrual checkpoint consistent with the other state-mutating calls.
            AccrueLoanYield(appId, loanId, loan);
            loan = GetLoan(appId, loanId);

            // Only undercollateralized loans may be liquidated.
            BigInteger collateralValue = CollateralValueGas(appId, loan.Collateral);
            bool liquidatable = collateralValue * LIQUIDATION_THRESHOLD_BPS / 10000 < loan.Debt;
            ExecutionEngine.Assert(liquidatable, "loan is healthy: not liquidatable");

            // Liquidator covers the full debt from prepaid GAS credit.
            StorageMap gasCredits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
            ByteString creditKey = (ByteString)(byte[])liquidator;
            ByteString creditData = gasCredits.Get(creditKey);
            BigInteger credit = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(credit >= loan.Debt, "insufficient GAS credit to cover debt");

            BigInteger debtRepaid = loan.Debt;
            BigInteger seized = loan.Collateral;

            BigInteger remainingCredit = credit - debtRepaid;
            if (remainingCredit == 0) gasCredits.Delete(creditKey);
            else gasCredits.Put(creditKey, remainingCredit);

            // Effects: close the loan and update the platform aggregates before the NEO transfer.
            UInt160 borrower = loan.Borrower;
            loan.TotalRepaid += debtRepaid;
            loan.Debt = 0;
            loan.Active = false;
            StoreLoan(appId, loanId, loan);

            UpdateTotalDebt(appId, debtRepaid, false);
            UpdateTotalRepaid(appId, debtRepaid);
            UpdateTotalCollateral(appId, seized, false);

            // Audit fix A10: the liquidator's GAS repaid the debt into the contract,
            // so it returns to the lending liquidity pool just like a normal repay.
            RefillLendingLiquidity(appId, debtRepaid);

            // Interaction: hand the seized collateral to the liquidator.
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, liquidator, seized),
                "collateral seize transfer failed");

            OnLoanLiquidated(appId, loanId, borrower, liquidator, debtRepaid, seized);
        }

        /// <summary>
        /// True when the loan's priced collateral has fallen below the liquidation threshold and
        /// the loan can be liquidated. Convenience view for keepers/monitors.
        /// </summary>
        [Safe]
        public static bool IsLiquidatable(string appId, BigInteger loanId)
        {
            Loan loan = GetLoan(appId, loanId);
            if (!loan.Active || loan.Debt <= 0) return false;
            BigInteger collateralValue = CollateralValueGas(appId, loan.Collateral);
            return collateralValue * LIQUIDATION_THRESHOLD_BPS / 10000 < loan.Debt;
        }

        #endregion
    }
}
