using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region End Round

        /// <summary>
        /// Check and end round if timer expired.
        /// </summary>
        public static void CheckAndEndRound()
        {
            ValidateNotGloballyPaused(APP_ID);

            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            ExecutionEngine.Assert(round.Active, "no active round");
            ExecutionEngine.Assert(Runtime.Time >= round.EndTime, "round not ended");

            SettleRound(roundId);
        }

        #endregion
    }
}
