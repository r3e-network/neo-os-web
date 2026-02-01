using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Internal Helpers

        /// <summary>
        /// Process draw result and complete the round.
        /// 
        /// PROCESS:
        /// - Calculates prize pool with rollover
        /// - Selects winner using randomness
        /// - Updates winner statistics
        /// - Stores completed round data
        /// - Starts new round
        /// - Emits WinnerDrawn and RoundCompleted events
        /// 
        /// PRIZE CALCULATION:
        /// - Total pool = current pool + rollover
        /// - Prize = pool * (100% - platform fee%)
        /// - Platform fee goes to treasury
        /// </summary>
        /// <param name="requestId">RNG request ID</param>
        /// <param name="roundId">Round being drawn</param>
        /// <param name="result">Random result bytes</param>
        private static void ProcessDrawResult(BigInteger requestId, BigInteger roundId, ByteString result)
        {
            BigInteger pool = PrizePool() + RolloverAmount();
            BigInteger prize = pool * (100 - PLATFORM_FEE_PERCENT) / 100;
            BigInteger totalTickets = TotalTickets();

            UInt160 winner = SelectWinner(roundId, result, totalTickets);

            if (winner != UInt160.Zero && winner != Admin())
            {
                UpdatePlayerStatsOnWin(winner, prize);
            }

            StoreCompletedRound(roundId, totalTickets, pool, winner, prize);
            StartNewRound(roundId);

            DeleteRequestData(requestId);

            OnWinnerDrawn(winner, prize, roundId);
            OnRoundCompleted(roundId, winner, prize, totalTickets);
        }

        /// <summary>
        /// [DEPRECATED] O(n) participant iteration - use SettleRoundOptimized instead.
        /// Frontend calculates winner using GetRoundParticipantsForFrontend() data,
        /// then calls SettleRoundOptimized() with O(1) verification.
        /// </summary>
        private static UInt160 SelectWinner(BigInteger roundId, ByteString randomness, BigInteger totalTickets)
        {
            if (totalTickets == 0) return Admin();

            ByteString hash = CryptoLib.Sha256(randomness);
            byte[] hashBytes = (byte[])hash;
            BigInteger winningTicket = 0;
            for (int i = 0; i < 8; i++)
            {
                winningTicket = winningTicket * 256 + hashBytes[i];
            }
            winningTicket = winningTicket % totalTickets;

            BigInteger participantCount = GetParticipantCount(roundId);
            BigInteger ticketsSoFar = 0;

            for (BigInteger i = 0; i < participantCount; i++)
            {
                byte[] participantKey = Helper.Concat(PREFIX_PARTICIPANTS, (ByteString)roundId.ToByteArray());
                participantKey = Helper.Concat(participantKey, (ByteString)i.ToByteArray());
                UInt160 participant = (UInt160)Storage.Get(Storage.CurrentContext, participantKey);

                byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, participant);
                ticketKey = Helper.Concat(ticketKey, (ByteString)roundId.ToByteArray());
                BigInteger tickets = (BigInteger)Storage.Get(Storage.CurrentContext, ticketKey);

                ticketsSoFar += tickets;
                if (winningTicket < ticketsSoFar)
                {
                    return participant;
                }
            }

            return Admin();
        }

        #endregion
    }
}
