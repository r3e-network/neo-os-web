using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Game Status

        [Safe]
        public static Map<string, object> GetGameStatus()
        {
            Map<string, object> status = new Map<string, object>();

            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);

            status["roundId"] = roundId;
            status["active"] = round.Active;
            status["pot"] = round.Pot;
            status["totalKeys"] = round.TotalKeys;
            status["lastBuyer"] = round.LastBuyer;
            status["currentKeyPrice"] = GetCurrentKeyPrice();

            if (round.Active)
            {
                BigInteger remaining = round.EndTime - Runtime.Time;
                status["remainingTime"] = remaining > 0 ? remaining : 0;
                status["remainingSeconds"] = remaining > 0 ? remaining : 0;
                status["status"] = remaining > 0 ? "active" : "ending";
            }
            else
            {
                status["status"] = round.Settled ? "settled" : "ended";
                status["winner"] = round.Winner;
                status["winnerPrize"] = round.WinnerPrize;
            }

            return status;
        }

        #endregion
    }
}
