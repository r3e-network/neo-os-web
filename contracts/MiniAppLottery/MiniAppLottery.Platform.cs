using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Platform Stats

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
