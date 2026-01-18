using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Deployment

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PRIZES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ROLLOVER, 0);

            // Initialize first round
            RoundData round = new RoundData
            {
                Id = 1,
                TotalTickets = 0,
                PrizePool = 0,
                ParticipantCount = 0,
                Winner = UInt160.Zero,
                WinnerPrize = 0,
                StartTime = Runtime.Time,
                EndTime = 0,
                Completed = false
            };
            StoreRoundData(1, round);
        }

        #endregion
    }
}
