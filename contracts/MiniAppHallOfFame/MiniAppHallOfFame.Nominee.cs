using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Add Nominee

        public static void AddNominee(UInt160 caller, string category, string nominee, string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(caller);
            ExecutionEngine.Assert(IsCategoryActive(category), "invalid category");
            ExecutionEngine.Assert(nominee.Length > 0 && nominee.Length <= MAX_NOMINEE_LENGTH, "invalid nominee");

            Nominee existing = GetNominee(category, nominee);
            ExecutionEngine.Assert(!HasStoredNominee(existing), "nominee exists");

            Nominee newNominee = new Nominee
            {
                Name = nominee,
                Category = category,
                Description = description,
                AddedBy = caller,
                AddedTime = Runtime.Time,
                TotalVotes = 0,
                VoteCount = 0,
                Inducted = false
            };
            StoreNominee(category, nominee, newNominee);

            BigInteger totalNominees = TotalNominees();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_NOMINEES, totalNominees + 1);

            UpdateUserStatsOnNominee(caller);

            OnNomineeAdded(category, nominee, caller, description);
        }

        #endregion
    }
}
