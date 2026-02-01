using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region User Methods

        /// <summary>
        /// Buy tickets for a specific lottery type
        /// Routes to instant scratch or scheduled lottery based on type
        /// </summary>
        public static BigInteger BuyTicketsForType(
            UInt160 player,
            byte lotteryType,
            BigInteger ticketCount,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(lotteryType <= 5, "invalid lottery type");

            LotteryConfig config = GetLotteryConfig(lotteryType);
            ExecutionEngine.Assert(config.Enabled, "lottery type disabled");

            if (config.IsInstant)
            {
                // Instant lottery - buy scratch tickets
                ExecutionEngine.Assert(ticketCount == 1, "instant: 1 ticket only");
                return BuyScratchTicket(player, lotteryType, receiptId);
            }
            else
            {
                // Scheduled lottery - buy round tickets
                BuyScheduledTickets(player, lotteryType, ticketCount, receiptId);
                return 0;
            }
        }

        /// <summary>
        /// Buy tickets for scheduled lottery type
        /// </summary>
        private static void BuyScheduledTickets(
            UInt160 player,
            byte lotteryType,
            BigInteger ticketCount,
            BigInteger receiptId)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            BigInteger totalCost = ticketCount * config.TicketPrice;

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidateGameBetLimits(player, totalCost);
            ValidatePaymentReceipt(APP_ID, player, totalCost, receiptId);

            // Get type-specific round
            TypeRoundData round = GetTypeRound(lotteryType);
            ExecutionEngine.Assert(!round.DrawPending, "draw in progress");

            // Update round data
            round.TotalTickets += ticketCount;
            round.PrizePool += totalCost;
            round.ParticipantCount += 1;
            StoreTypeRound(lotteryType, round);

            // Update type pool
            UpdateTypePoolStats(lotteryType, totalCost);

            RecordGameBet(player, totalCost);
            OnTypeTicketPurchased(player, lotteryType, ticketCount, round.RoundId);
        }

        /// <summary>
        /// Legacy method - buys tickets for default lottery (DoubleColor)
        /// Maintained for backward compatibility
        /// </summary>
        public static void BuyTickets(UInt160 player, BigInteger ticketCount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(ticketCount > 0 && ticketCount <= MAX_TICKETS_PER_TX, "1-100 tickets max");
            ExecutionEngine.Assert(!IsDrawPending(), "draw in progress");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            BigInteger totalCost = ticketCount * TICKET_PRICE;
            BigInteger roundId = CurrentRound();

            ValidateGameBetLimits(player, totalCost);
            ValidatePaymentReceipt(APP_ID, player, totalCost, receiptId);

            // Check if new player
            PlayerStats stats = GetPlayerStats(player);
            bool isNewPlayer = stats.JoinTime == 0;

            // Update player tickets for this round
            byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, player);
            ticketKey = Helper.Concat(ticketKey, (ByteString)roundId.ToByteArray());
            BigInteger existing = (BigInteger)Storage.Get(Storage.CurrentContext, ticketKey);
            Storage.Put(Storage.CurrentContext, ticketKey, existing + ticketCount);

            // Track participant
            if (existing == 0)
            {
                BigInteger participantCount = GetParticipantCount(roundId);
                byte[] participantKey = Helper.Concat(PREFIX_PARTICIPANTS, (ByteString)roundId.ToByteArray());
                participantKey = Helper.Concat(participantKey, (ByteString)participantCount.ToByteArray());
                Storage.Put(Storage.CurrentContext, participantKey, player);
                SetParticipantCount(roundId, participantCount + 1);
            }

            // Update totals
            BigInteger currentTotal = TotalTickets();
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_COUNT, currentTotal + ticketCount);
            BigInteger pool = PrizePool();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, pool + totalCost);

            // Update player stats
            UpdatePlayerStatsOnPurchase(player, ticketCount, totalCost, isNewPlayer);

            RecordGameBet(player, totalCost);
            OnTicketPurchased(player, ticketCount, roundId);
        }

        #endregion
    }
}
