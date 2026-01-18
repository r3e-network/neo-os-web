using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            if (round.Active && Runtime.Time >= round.EndTime)
            {
                SettleRound(roundId);
            }
        }

        #endregion
    }
}
