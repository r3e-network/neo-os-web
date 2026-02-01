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

        /// <summary>
        /// Get detailed information about a lottery round.
        /// 
        /// RETURNS:
        /// - id: Round ID
        /// - totalTickets: Total tickets sold
        /// - prizePool: Total prize pool amount
        /// - participantCount: Number of participants
        /// - winner: Winner address (if completed)
        /// - winnerPrize: Winner prize amount (if completed)
        /// - startTime: Round start timestamp
        /// - endTime: Round end timestamp
        /// - completed: Whether round is completed
        /// </summary>
        /// <param name="roundId">Round ID to query</param>
        /// <returns>Map of round details (empty if not found)</returns>
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
