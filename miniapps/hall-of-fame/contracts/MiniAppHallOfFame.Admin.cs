using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Admin Methods

        /// <summary>
        /// Add a new voting category (admin only).
        /// 
        /// REQUIREMENTS:
        /// - Caller must be contract admin
        /// - Category name: 1-50 characters
        /// 
        /// EFFECTS:
        /// - Creates new category
        /// - Enables nominees in category
        /// </summary>
        /// <param name="category">New category name</param>
        /// <exception cref="Exception">If not admin or invalid category</exception>
        public static void AddCategory(string category)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(category.Length > 0 && category.Length <= MAX_CATEGORY_LENGTH, "invalid category");
            var key = GetCategoryKey(category);
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        /// <summary>
        /// Start a new voting season (admin only).
        /// 
        /// REQUIREMENTS:
        /// - Caller must be contract admin
        /// - No active season currently
        /// 
        /// EFFECTS:
        /// - Increments season ID
        /// - Creates new season record
        /// - Sets start and end times (30 days)
        /// - Emits SeasonStarted event
        /// 
        /// SEASON DURATION: 30 days (SEASON_DURATION_SECONDS)
        /// </summary>
        /// <exception cref="Exception">If season already active</exception>
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
