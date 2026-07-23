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
        /// <summary>
        /// Borrower explicitly walks away from an outstanding loan, forfeiting
        /// the NEO collateral. The contract retains the NEO until the app admin
        /// sweeps it via <see cref="WithdrawAbandonedCollateral"/>.
        ///
        /// Without this path the loan ledger could grow forever with stale
        /// "active" loans where the borrower has clearly disengaged. Making the
        /// abandonment explicit gives every loan a defined closure: repaid,
        /// closed normally, or abandoned with forfeited collateral.
        ///
        /// Abandoned loans keep <c>loan.Debt &gt; 0</c> on storage so the pair
        /// <c>(Active == false, Debt &gt; 0)</c> uniquely distinguishes them
        /// from normally-closed loans (which have <c>Debt == 0</c>).
        /// </summary>
        public static void AbandonLoan(string appId, BigInteger loanId)
        {
            ValidateApp(appId, ProductType_Lending);

            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(loan.Active, "loan not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(loan.Borrower), "unauthorized");

            loan.Active = false;
            StoreLoan(appId, loanId, loan);

            // Move the collateral out of the active-loans accumulator into the
            // abandoned-collateral pool. Net contract NEO holdings unchanged.
            UpdateTotalCollateral(appId, loan.Collateral, false);
            ByteString abandonedKey = AppKey(appId, PREFIX_TOTAL_ABANDONED_COLLATERAL);
            Put(abandonedKey, GetBigInteger(abandonedKey) + loan.Collateral);

            // Subtract the outstanding debt from the platform total so
            // observability numbers reflect the cleared liability.
            if (loan.Debt > 0)
            {
                UpdateTotalDebt(appId, loan.Debt, false);
            }

            OnLoanAbandoned(appId, loanId, loan.Borrower, loan.Collateral);
        }

        /// <summary>
        /// Sweep accumulated abandoned-loan NEO collateral to a designated
        /// recipient. Gated by ValidateAppAuthority — platform admin or the
        /// app's own admin. Mirrors the capsule penalty withdrawal pattern:
        /// the counter is reset BEFORE the NEO transfer (checks-effects-
        /// interactions) so a re-entrant NEO contract cannot drain twice.
        /// </summary>
        public static void WithdrawAbandonedCollateral(string appId, UInt160 to)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);

            ByteString abandonedKey = AppKey(appId, PREFIX_TOTAL_ABANDONED_COLLATERAL);
            BigInteger amount = GetBigInteger(abandonedKey);
            ExecutionEngine.Assert(amount > 0, "no abandoned collateral");

            Put(abandonedKey, 0);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "abandoned collateral transfer failed");
            EnsureNeoCreditSolvent();

            OnAbandonedCollateralWithdrawn(appId, to, amount);
        }

        /// <summary>
        /// Read the per-app abandoned-collateral pool balance awaiting admin sweep.
        /// Abandoned loans themselves are identified by GetLoan(...) returning a
        /// record with Active==false &amp;&amp; Debt&gt;0.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalAbandonedCollateral(string appId)
        {
            return GetBigInteger(AppKey(appId, PREFIX_TOTAL_ABANDONED_COLLATERAL));
        }
    }
}
