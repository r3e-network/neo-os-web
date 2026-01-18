using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Admin Methods

        public static void AddCategory(string category)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(category.Length > 0 && category.Length <= MAX_CATEGORY_LENGTH, "invalid category");
            var key = GetCategoryKey(category);
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        public static void StartSeason()
        {
            ValidateAdmin();

            BigInteger currentId = CurrentSeasonId();
            if (currentId > 0)
            {
                Season current = GetSeason(currentId);
                ExecutionEngine.Assert(!current.Active, "season active");
            }

            BigInteger newSeasonId = currentId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON_ID, newSeasonId);

            Season season = new Season
            {
                Id = newSeasonId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + SEASON_DURATION_SECONDS,
                TotalVotes = 0,
                VoterCount = 0,
                Active = true,
                Settled = false
            };
            StoreSeason(newSeasonId, season);

            OnSeasonStarted(newSeasonId, season.StartTime, season.EndTime);
        }

        #endregion
    }
}
