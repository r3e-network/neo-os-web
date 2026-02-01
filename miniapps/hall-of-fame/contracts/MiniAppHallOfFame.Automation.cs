using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Automation

        /// <summary>
        /// Automated season end triggered by periodic execution.
        /// 
        /// PERMISSIONS:
        /// - Only callable by authorized automation anchor
        /// 
        /// EFFECTS:
        /// - Automatically ends season when end time reached
        /// - Marks season as inactive and settled
        /// 
        /// AUTOMATION:
        /// - Called periodically by automation service
        /// - Ensures seasons end even without manual intervention
        /// </summary>
        /// <param name="taskId">Automation task ID</param>
        /// <param name="payload">Task payload data</param>
        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
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
