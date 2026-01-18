using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Admin Methods

        public static void StartNewRound()
        {
            ValidateAdmin();

            BigInteger currentId = CurrentRoundId();
            if (currentId > 0)
            {
                Round current = GetRound(currentId);
                ExecutionEngine.Assert(!current.Active, "round active");
            }

            BigInteger newRoundId = currentId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, newRoundId);

            Round round = new Round
            {
                Id = newRoundId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + INITIAL_DURATION_SECONDS,
                Pot = 0,
                TotalKeys = 0,
                LastBuyer = UInt160.Zero,
                Winner = UInt160.Zero,
                WinnerPrize = 0,
                Active = true,
                Settled = false
            };
            StoreRound(newRoundId, round);

            OnRoundStarted(newRoundId, round.EndTime, 0);
        }

        #endregion
    }
}
