using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Round Query

        [Safe]
        public static Map<string, object> GetRoundDetails(BigInteger roundId)
        {
            RoundData round = GetRoundData(roundId);
            Map<string, object> details = new Map<string, object>();
            if (round.Id == 0) return details;

            details["id"] = round.Id;
            details["totalTickets"] = round.TotalTickets;
            details["prizePool"] = round.PrizePool;
            details["participantCount"] = round.ParticipantCount;
            details["winner"] = round.Winner;
            details["winnerPrize"] = round.WinnerPrize;
            details["startTime"] = round.StartTime;
            details["endTime"] = round.EndTime;
            details["completed"] = round.Completed;

            return details;
        }

        #endregion
    }
}
