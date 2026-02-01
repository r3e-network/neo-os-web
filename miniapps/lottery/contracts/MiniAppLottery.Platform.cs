using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Platform Stats

        /// <summary>
        /// Get comprehensive platform statistics.
        /// 
        /// RETURNS:
        /// - currentRound: Current round ID
        /// - prizePool: Current prize pool amount
        /// - totalTickets: Total tickets sold
        /// - totalPlayers: Number of unique players
        /// - totalPrizesDistributed: Total prizes paid
        /// - rolloverAmount: Rollover to next round
        /// - ticketPrice: Price per ticket
        /// - platformFee: Platform fee percentage
        /// - maxTicketsPerTx: Max tickets per transaction
        /// - minParticipants: Minimum participants for draw
        /// - isDrawPending: Whether draw is in progress
        /// </summary>
        /// <returns>Map of platform statistics</returns>
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["currentRound"] = CurrentRound();
            stats["prizePool"] = PrizePool();
            stats["totalTickets"] = TotalTickets();
            stats["totalPlayers"] = TotalPlayers();
            stats["totalPrizesDistributed"] = TotalPrizesDistributed();
            stats["rolloverAmount"] = RolloverAmount();
            stats["ticketPrice"] = TICKET_PRICE;
            stats["platformFee"] = PLATFORM_FEE_PERCENT;
            stats["maxTicketsPerTx"] = MAX_TICKETS_PER_TX;
            stats["minParticipants"] = MIN_PARTICIPANTS;
            stats["isDrawPending"] = IsDrawPending();
            return stats;
        }

        #endregion
    }
}
