using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        [Safe]
        public static BigInteger GetLendingProfile(string appId)
        {
            ByteString config = GetRaw(AppKey(appId, PREFIX_APP_CONFIG));
            if (config == null || config.Length != 1) return LendingProfile_RiskManaged;
            BigInteger profile = (BigInteger)config;
            return profile == LendingProfile_SelfLoan
                ? LendingProfile_SelfLoan
                : LendingProfile_RiskManaged;
        }

        [Safe]
        public static BigInteger GetActiveLoanId(string appId, UInt160 borrower)
        {
            if (borrower == UInt160.Zero || !borrower.IsValid) return 0;
            return GetBigInteger(AppKey(appId, PREFIX_ACTIVE_LOAN, borrower));
        }

        [Safe]
        public static Map<string, object> GetSingleLoanPosition(string appId, UInt160 borrower)
        {
            BigInteger loanId = GetActiveLoanId(appId, borrower);
            Loan loan = loanId > 0 ? GetLoan(appId, loanId) : new Loan();
            Map<string, object> position = new Map<string, object>();
            position["loanId"] = loanId;
            position["borrower"] = loanId > 0 ? loan.Borrower : borrower;
            position["collateral"] = loan.Collateral;
            position["borrowed"] = loan.Debt;
            position["ltvBps"] = loan.LtvBps;
            position["active"] = loan.Active;
            return position;
        }

        private static void EnsureLendingProfileCanOpenLoan(string appId, UInt160 borrower)
        {
            if (GetLendingProfile(appId) != LendingProfile_SelfLoan) return;
            BigInteger loanId = GetActiveLoanId(appId, borrower);
            if (loanId == 0) return;
            Loan loan = GetLoan(appId, loanId);
            ExecutionEngine.Assert(!loan.Active, "loan already active");
            Delete(AppKey(appId, PREFIX_ACTIVE_LOAN, borrower));
        }

        private static void TrackLendingProfileLoan(
            string appId,
            UInt160 borrower,
            BigInteger loanId)
        {
            if (GetLendingProfile(appId) != LendingProfile_SelfLoan) return;
            Put(AppKey(appId, PREFIX_ACTIVE_LOAN, borrower), loanId);
        }

        private static void ClearLendingProfileLoan(
            string appId,
            UInt160 borrower,
            BigInteger loanId)
        {
            if (GetLendingProfile(appId) != LendingProfile_SelfLoan) return;
            ByteString key = AppKey(appId, PREFIX_ACTIVE_LOAN, borrower);
            if (GetBigInteger(key) == loanId) Delete(key);
        }
    }
}
