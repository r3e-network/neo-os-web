using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Current Round Info

        /// <summary>
        /// Get information about the current active round.
        /// 
        /// RETURNS:
        /// - roundId: Current round ID
        /// - prizePool: Total prize pool (including rollover)
        /// - totalTickets: Total tickets sold
        /// - participantCount: Number of participants
        /// - startTime: Round start timestamp
        /// - isDrawPending: Whether draw is in progress
        /// - ticketPrice: Price per ticket
        /// - minParticipants: Minimum for draw
        /// </summary>
        /// <returns>Map of current round info</returns>
        [Safe]
        public static Map<string, object> GetCurrentRoundInfo()
        {
            BigInteger roundId = CurrentRound();
            RoundData round = GetRoundData(roundId);
            Map<string, object> info = new Map<string, object>();

            info["roundId"] = roundId;
            info["prizePool"] = PrizePool() + RolloverAmount();
            info["totalTickets"] = TotalTickets();
            info["participantCount"] = GetParticipantCount(roundId);
            info["startTime"] = round.StartTime;
            info["isDrawPending"] = IsDrawPending();
            info["ticketPrice"] = TICKET_PRICE;
            info["minParticipants"] = MIN_PARTICIPANTS;

            return info;
        }

        #endregion
    }
}
