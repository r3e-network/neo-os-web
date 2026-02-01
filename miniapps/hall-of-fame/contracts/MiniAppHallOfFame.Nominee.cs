using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Add Nominee

        /// <summary>
        /// Add a new nominee to a category.
        /// 
        /// REQUIREMENTS:
        /// - Platform not globally paused
        /// - Caller must be authenticated
        /// - Category must be active
        /// - Nominee name: 1-100 characters
        /// - Nominee must not already exist
        /// 
        /// EFFECTS:
        /// - Creates nominee record
        /// - Increments total nominee count
        /// - Updates user stats for nominator
        /// - Emits NomineeAdded event
        /// 
        /// LIMITS:
        /// - Description max 500 characters
        /// </summary>
        /// <param name="caller">Address adding the nominee</param>
        /// <param name="category">Category for the nominee</param>
        /// <param name="nominee">Nominee name</param>
        /// <param name="description">Nominee description</param>
        /// <exception cref="Exception">If validation fails or unauthorized</exception>
        public static void AddNominee(UInt160 caller, string category, string nominee, string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "unauthorized");
            ExecutionEngine.Assert(IsCategoryActive(category), "invalid category");
            ExecutionEngine.Assert(nominee.Length > 0 && nominee.Length <= MAX_NOMINEE_LENGTH, "invalid nominee");

            Nominee existing = GetNominee(category, nominee);
            ExecutionEngine.Assert(existing.AddedBy == UInt160.Zero, "nominee exists");

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
