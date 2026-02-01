using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region End Season

        /// <summary>
        /// End the current voting season.
        /// 
        /// REQUIREMENTS:
        /// - Platform not globally paused
        /// - Season must be active
        /// - Current time must be past season end time
        /// 
        /// EFFECTS:
        /// - Marks season as inactive
        /// - Marks season as settled
        /// - Prevents further votes
        /// - Enables winner selection and induction
        /// 
        /// TIMING:
        /// - Seasons run for 30 days (SEASON_DURATION_SECONDS)
        /// - Can only be ended after end time reached
        /// </summary>
        /// <exception cref="Exception">If no active season or season not ended yet</exception>
        public static void EndSeason()
        {
            ValidateNotGloballyPaused(APP_ID);

            BigInteger seasonId = CurrentSeasonId();
            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Active, "no active season");
            ExecutionEngine.Assert(Runtime.Time >= season.EndTime, "season not ended");

            season.Active = false;
            season.Settled = true;
            StoreSeason(seasonId, season);
        }

        #endregion
    }
}
