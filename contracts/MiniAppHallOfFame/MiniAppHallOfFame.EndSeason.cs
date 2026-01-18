using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region End Season

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
