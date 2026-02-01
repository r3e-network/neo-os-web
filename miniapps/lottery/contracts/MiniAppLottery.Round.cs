using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Round Management

        /// <summary>
        /// Store completed round data and update totals.
        /// 
        /// EFFECTS:
        /// - Creates round data record
        /// - Records winner and prize
        /// - Sets completion timestamp
        /// - Updates total prizes distributed
        /// </summary>
        /// <param name="roundId">Round ID</param>
        /// <param name="totalTickets">Total tickets sold</param>
        /// <param name="pool">Total prize pool</param>
        /// <param name="winner">Winner address</param>
        /// <param name="prize">Prize amount</param>
        private static void StoreCompletedRound(BigInteger roundId, BigInteger totalTickets, BigInteger pool, UInt160 winner, BigInteger prize)
        {
            RoundData round = new RoundData
            {
                Id = roundId,
                TotalTickets = totalTickets,
                PrizePool = pool,
                ParticipantCount = GetParticipantCount(roundId),
                Winner = winner,
                WinnerPrize = prize,
                StartTime = GetRoundData(roundId).StartTime,
                EndTime = Runtime.Time,
                Completed = true
            };
            StoreRoundData(roundId, round);

            BigInteger totalPrizes = TotalPrizesDistributed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PRIZES, totalPrizes + prize);
        }

        /// <summary>
        /// Start a new lottery round.
        /// 
        /// EFFECTS:
        /// - Increments round ID
        /// - Resets pool, ticket count, draw pending
        /// - Creates new round data
        /// - Sets start timestamp
        /// </summary>
        /// <param name="previousRoundId">Previous round ID</param>
        private static void StartNewRound(BigInteger previousRoundId)
        {
            BigInteger newRoundId = previousRoundId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, newRoundId);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ROLLOVER, 0);

            RoundData newRound = new RoundData
            {
                Id = newRoundId,
                StartTime = Runtime.Time,
                Completed = false
            };
            StoreRoundData(newRoundId, newRound);
        }

        #endregion
    }
}
