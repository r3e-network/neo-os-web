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
        ///
        /// Audit fix FixV (price-manipulation liquidation): the update is now bounded so a
        /// rogue/compromised authority cannot crash the price in one step and confiscate
        /// collateral:
        ///   (a) per-update deviation cap — the new price may differ from the stored price by
        ///       at most +/- MAX_PRICE_DEVIATION_BPS;
        ///   (b) minimum update interval — at least MIN_PRICE_UPDATE_INTERVAL_MS must elapse
        ///       between updates so the cap cannot be laddered around within one block/window;
        ///   (c) price-drop grace — when the price decreases, the drop timestamp is recorded
        ///       and LiquidateLoan refuses to act on the lowered valuation until the grace
        ///       window passes (see <see cref="LiquidateLoan"/>).
        /// The very first price an app sets (no prior price stored) is unrestricted so the
        /// keeper can establish the initial valuation.
        /// </summary>
        public static void SetNeoGasPrice(string appId, BigInteger price)
        {
            ValidateApp(appId, ProductType_Lending);
            ValidateAppAuthority(appId);
            ExecutionEngine.Assert(price > 0, "price must be positive");

            ByteString priceKey = AppKey(appId, PREFIX_NEO_GAS_PRICE);
            BigInteger stored = GetBigInteger(priceKey); // 0 == never set
            BigInteger nowTime = Runtime.Time;

            if (stored > 0)
            {
                // (b) Rate-limit updates so the deviation cap cannot be bypassed by spamming.
                BigInteger lastTime = GetBigInteger(AppKey(appId, PREFIX_NEO_GAS_PRICE_TIME));
                ExecutionEngine.Assert(
                    nowTime - lastTime >= (BigInteger)MIN_PRICE_UPDATE_INTERVAL_MS,
                    "price update too frequent");

                // (a) Bound the per-update move to +/- MAX_PRICE_DEVIATION_BPS of the stored price.
                BigInteger maxDelta = stored * MAX_PRICE_DEVIATION_BPS / 10000;
                BigInteger lowerBound = stored - maxDelta;
                BigInteger upperBound = stored + maxDelta;
                ExecutionEngine.Assert(price >= lowerBound && price <= upperBound,
                    "price deviation exceeds cap");

                // (c) Record the start of the liquidation grace window on any decrease.
                if (price < stored)
                {
                    Put(AppKey(appId, PREFIX_PRICE_DROP_TIME), nowTime);
                    OnPriceDropRecorded(appId, stored, price, nowTime);
                }
            }

            Put(priceKey, price);
            Put(AppKey(appId, PREFIX_NEO_GAS_PRICE_TIME), nowTime);
            OnNeoGasPriceUpdated(appId, price);
        }

        /// <summary>Timestamp of the most recent NEO/GAS price decrease (0 if none). View for keepers.</summary>
        [Safe]
        public static BigInteger GetLastPriceDropTime(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_PRICE_DROP_TIME));

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

            // Audit fix FixV (c): if the price was recently decreased, give borrowers a grace
            // window to top up / repay before liquidation may act on the lowered valuation.
            BigInteger dropTime = GetBigInteger(AppKey(appId, PREFIX_PRICE_DROP_TIME));
            if (dropTime > 0)
            {
                ExecutionEngine.Assert(
                    Runtime.Time >= dropTime + (BigInteger)LIQUIDATION_GRACE_MS,
                    "liquidation grace period active");
            }

            // Liquidator covers the full debt from this app's prepaid GAS credit.
            BigInteger credit = GetGasCreditBalance(appId, liquidator);
            ExecutionEngine.Assert(credit >= loan.Debt, "insufficient GAS credit to cover debt");

            BigInteger debtRepaid = loan.Debt;

            // Audit fix FixV (Med): seize only enough collateral to cover the debt plus a
            // bounded liquidation bonus; return any surplus to the borrower. The amount of
            // NEO seized is debt*(1+bonus) valued at the current price, capped at the loan's
            // collateral. The remainder is credited back to the borrower's NEO credit ledger.
            BigInteger neoPrice = GetNeoGasPrice(appId);
            BigInteger seizeTarget = SeizeCollateralForDebt(debtRepaid, neoPrice);
            BigInteger seized = seizeTarget < loan.Collateral ? seizeTarget : loan.Collateral;
            BigInteger surplus = loan.Collateral - seized;

            ConsumeGasCredit(appId, liquidator, debtRepaid);

            // Effects: close the loan and update the platform aggregates before the NEO transfer.
            UInt160 borrower = loan.Borrower;
            loan.TotalRepaid += debtRepaid;
            loan.Debt = 0;
            loan.Active = false;
            StoreLoan(appId, loanId, loan);

            UpdateTotalDebt(appId, debtRepaid, false);
            UpdateTotalRepaid(appId, debtRepaid);
            // The whole collateral leaves the loan's collateral accounting: part to the
            // liquidator, part back to the borrower as withdrawable NEO credit.
            UpdateTotalCollateral(appId, loan.Collateral, false);

            // Audit fix A10: the liquidator's GAS repaid the debt into the contract,
            // so it returns to the lending liquidity pool just like a normal repay.
            RefillLendingLiquidity(appId, debtRepaid);

            // Audit fix FixV (Med): credit the surplus collateral back to the borrower so an
            // over-collateralized liquidation does not confiscate more than debt + bonus. The
            // NEO stays in the contract (no transfer) and is reclaimable via WithdrawNeoCredit.
            if (surplus > 0)
            {
                CreditNeo(appId, borrower, surplus);
                OnLiquidationSurplusReturned(appId, loanId, borrower, surplus);
            }

            // Interaction: hand the seized collateral to the liquidator.
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, liquidator, seized),
                "collateral seize transfer failed");
            EnsureNeoCreditSolvent();

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
