using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            BigInteger seasonId = CurrentSeasonId();
            Season season = GetSeason(seasonId);
            if (season.Active && Runtime.Time >= season.EndTime)
            {
                season.Active = false;
                season.Settled = true;
                StoreSeason(seasonId, season);
            }
        }

        #endregion
    }
}
