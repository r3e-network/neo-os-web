using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSelfLoan
    {
        #region Internal Helpers

        private static void StoreLoan(BigInteger loanId, Loan loan)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_LOANS, (ByteString)loanId.ToByteArray()),
                StdLib.Serialize(loan));
        }

        private static BigInteger GetLtvForTier(BigInteger tier)
        {
            if (tier == 1) return LTV_TIER1_BPS;
            if (tier == 2) return LTV_TIER2_BPS;
            return LTV_TIER3_BPS;
        }

        private static void AddUserLoan(UInt160 user, BigInteger loanId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_LOAN_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_LOANS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, loanId);
        }

        private static void UpdateTotalCollateral(BigInteger amount, bool isDeposit)
        {
            BigInteger total = TotalCollateral();
            if (isDeposit)
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COLLATERAL, total + amount);
            else
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COLLATERAL, total - amount);
        }

        private static void UpdateTotalDebt(BigInteger amount, bool isIncrease)
        {
            BigInteger total = TotalDebt();
            if (isIncrease)
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DEBT, total + amount);
            else
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DEBT, total - amount);
        }

        private static void UpdateTotalRepaid(BigInteger amount)
        {
            BigInteger total = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REPAID);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REPAID, total + amount);
        }

        private static void StoreBorrowerStats(UInt160 borrower, BorrowerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, borrower),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
