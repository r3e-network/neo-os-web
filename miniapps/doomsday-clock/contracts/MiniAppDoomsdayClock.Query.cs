using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetRoundDetails(BigInteger roundId)
        {
            Round round = GetRound(roundId);
            Map<string, object> details = new Map<string, object>();

            details["id"] = round.Id;
            details["startTime"] = round.StartTime;
            details["endTime"] = round.EndTime;
            details["pot"] = round.Pot;
            details["totalKeys"] = round.TotalKeys;
            details["lastBuyer"] = round.LastBuyer;
            details["winner"] = round.Winner;
            details["winnerPrize"] = round.WinnerPrize;
            details["active"] = round.Active;
            details["settled"] = round.Settled;

            if (round.Active)
            {
                BigInteger remaining = round.EndTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
                details["currentKeyPrice"] = GetCurrentKeyPrice();
            }

            return details;
        }

        #endregion
    }
}
