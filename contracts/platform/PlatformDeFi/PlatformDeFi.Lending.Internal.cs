using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        private static void StoreLoan(string appId, BigInteger loanId, Loan loan)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, PREFIX_LOANS, loanId),
                StdLib.Serialize(loan));
        }

        private static BigInteger GetLtvForTier(BigInteger tier)
        {
            ExecutionEngine.Assert(tier >= 1 && tier <= 3, "invalid LTV tier (1-3)");
            if (tier == 1) return LTV_TIER1_BPS;
            if (tier == 2) return LTV_TIER2_BPS;
            return LTV_TIER3_BPS;
        }

        private static void AddUserLoan(string appId, UInt160 user, BigInteger loanId)
        {
            ByteString countKey = AppKey(appId, PREFIX_USER_LOAN_COUNT, user);
            BigInteger count = GetBigInteger(countKey);
            Put(countKey, count + 1);

            ByteString key = AppKey(appId, PREFIX_USER_LOANS, count, user);
            Put(key, loanId);
        }

        private static void UpdateTotalCollateral(string appId, BigInteger amount, bool isDeposit)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_COLLATERAL);
            BigInteger total = GetBigInteger(key);
            Put(key, isDeposit ? total + amount : total - amount);
        }

        private static void UpdateTotalDebt(string appId, BigInteger amount, bool isIncrease)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_DEBT);
            BigInteger total = GetBigInteger(key);
            Put(key, isIncrease ? total + amount : total - amount);
        }

        private static void UpdateTotalRepaid(string appId, BigInteger amount)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_REPAID);
            BigInteger total = GetBigInteger(key);
            Put(key, total + amount);
        }

        private static void TransferLoanGasToBorrower(
            string appId,
            BigInteger loanId,
            UInt160 borrower,
            BigInteger amount)
        {
            ValidateApp(appId, ProductType_Lending);
            ExecutionEngine.Assert(loanId > 0, "invalid loan");
            ValidateAddress(borrower);
            ExecutionEngine.Assert(amount > 0, "loan payout required");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, borrower, amount);
            ExecutionEngine.Assert(transferred, "GAS transfer failed");
            EnsureGasCreditSolvent();
        }

        private static void ReturnLoanCollateralToBorrower(string appId, BigInteger loanId, Loan loan)
        {
            ValidateApp(appId, ProductType_Lending);
            ExecutionEngine.Assert(loanId > 0, "invalid loan");
            ValidateAddress(loan.Borrower);
            ExecutionEngine.Assert(!loan.Active, "loan still active");
            ExecutionEngine.Assert(loan.Debt == 0, "debt not fully repaid");
            ExecutionEngine.Assert(loan.Collateral > 0, "no collateral");

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral),
                "collateral return failed");
            EnsureNeoCreditSolvent();
        }
    }
}
