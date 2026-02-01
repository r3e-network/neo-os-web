using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Hybrid Mode - Frontend Winner Calculation

        // Script names for TEE computation
        private const string SCRIPT_DRAW_WINNER = "draw-winner";
        private const string SCRIPT_SCRATCH_PRIZE = "scratch-prize";

        // Storage prefix for cumulative ticket sums (prefix sum array)
        // NOTE: Using 0x60+ to avoid collision with app prefixes (0x40-0x5F)
        private static readonly byte[] PREFIX_CUMULATIVE = new byte[] { 0x60 };
        // Storage prefix for randomness hash (stored after RNG callback)
        private static readonly byte[] PREFIX_RANDOMNESS = new byte[] { 0x61 };
        // Storage prefix for scratch ticket seeds (using MiniAppComputeBase pattern)
        private static readonly byte[] PREFIX_SCRATCH_SEED = new byte[] { 0x62 };

        /// <summary>
        /// Get calculation constants for frontend.
        /// </summary>
        [Safe]
        public static Map<string, object> GetLotteryConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["ticketPrice"] = TICKET_PRICE;
            constants["platformFeePercent"] = PLATFORM_FEE_PERCENT;
            constants["maxTicketsPerTx"] = MAX_TICKETS_PER_TX;
            constants["minParticipants"] = MIN_PARTICIPANTS;
            constants["bigWinThreshold"] = BIG_WIN_THRESHOLD;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// [DEPRECATED] O(n) loop - use edge function to query storage directly.
        /// Edge function should query participant storage keys and build cumulative sums off-chain.
        /// This method is kept for small rounds only (< 100 participants).
        /// </summary>
        [Safe]
        public static Map<string, object> GetRoundParticipantsForFrontend(BigInteger roundId)
        {
            Map<string, object> result = new Map<string, object>();

            BigInteger participantCount = GetParticipantCount(roundId);
            result["participantCount"] = participantCount;
            result["totalTickets"] = TotalTickets();

            // Return participant list with cumulative sums
            // Frontend can use binary search on cumulative sums
            UInt160[] participants = new UInt160[(int)participantCount];
            BigInteger[] cumulativeSums = new BigInteger[(int)participantCount];
            BigInteger cumulative = 0;

            for (BigInteger i = 0; i < participantCount; i++)
            {
                byte[] participantKey = Helper.Concat(
                    PREFIX_PARTICIPANTS,
                    (ByteString)roundId.ToByteArray());
                participantKey = Helper.Concat(
                    participantKey,
                    (ByteString)i.ToByteArray());
                UInt160 participant = (UInt160)Storage.Get(
                    Storage.CurrentContext, participantKey);

                byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, participant);
                ticketKey = Helper.Concat(
                    ticketKey,
                    (ByteString)roundId.ToByteArray());
                BigInteger tickets = (BigInteger)Storage.Get(
                    Storage.CurrentContext, ticketKey);

                cumulative += tickets;
                participants[(int)i] = participant;
                cumulativeSums[(int)i] = cumulative;
            }

            result["participants"] = participants;
            result["cumulativeSums"] = cumulativeSums;

            return result;
        }

        /// <summary>
        /// Store randomness only (hybrid callback).
        /// Does NOT select winner - frontend does that.
        /// </summary>
        public static void StoreDrawRandomness(
            BigInteger requestId,
            ByteString randomness)
        {
            ValidateGateway();

            ByteString roundIdData = GetRequestData(requestId);
            ExecutionEngine.Assert(roundIdData != null, "unknown request");

            BigInteger roundId = (BigInteger)roundIdData;

            // Store randomness for frontend to calculate winner
            byte[] randomnessKey = Helper.Concat(
                PREFIX_RANDOMNESS,
                (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, randomnessKey, randomness);

            DeleteRequestData(requestId);

            // Emit event with randomness for frontend
            OnDrawRandomnessStored(roundId, randomness);
        }

        /// <summary>
        /// Get stored randomness for a round.
        /// </summary>
        [Safe]
        public static ByteString GetRoundRandomness(BigInteger roundId)
        {
            byte[] key = Helper.Concat(
                PREFIX_RANDOMNESS,
                (ByteString)roundId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Frontend submits calculated winner for verification.
        /// Contract verifies script hash and awards prize.
        /// </summary>
        public static bool SettleRoundWithWinner(
            BigInteger roundId,
            UInt160 claimedWinner,
            BigInteger claimedWinnerIndex,
            ByteString scriptHash)
        {
            ValidateNotGloballyPaused(APP_ID);

            // Verify script hash matches registered script
            ValidateScriptHash(SCRIPT_DRAW_WINNER, scriptHash);

            // Get stored randomness
            ByteString randomness = GetRoundRandomness(roundId);
            ExecutionEngine.Assert(
                randomness != null && randomness.Length > 0,
                "no randomness");

            // Verify the claimed winner
            BigInteger totalTickets = TotalTickets();
            ExecutionEngine.Assert(totalTickets > 0, "no tickets");

            // Calculate winning ticket from randomness
            ByteString hash = CryptoLib.Sha256(randomness);
            byte[] hashBytes = (byte[])hash;
            BigInteger winningTicket = 0;
            for (int i = 0; i < 8; i++)
            {
                winningTicket = winningTicket * 256 + hashBytes[i];
            }
            winningTicket = winningTicket % totalTickets;

            // Verify claimed winner owns the winning ticket
            bool verified = VerifyWinnerOwnsTicket(
                roundId,
                claimedWinner,
                claimedWinnerIndex,
                winningTicket);
            ExecutionEngine.Assert(verified, "invalid winner");

            // Award prize
            BigInteger pool = PrizePool() + RolloverAmount();
            BigInteger prize = pool * (100 - PLATFORM_FEE_PERCENT) / 100;

            if (claimedWinner != UInt160.Zero && claimedWinner != Admin())
            {
                UpdatePlayerStatsOnWin(claimedWinner, prize);
            }

            StoreCompletedRound(roundId, totalTickets, pool, claimedWinner, prize);
            StartNewRound(roundId);

            // Clear randomness
            byte[] randomnessKey = Helper.Concat(
                PREFIX_RANDOMNESS,
                (ByteString)roundId.ToByteArray());
            Storage.Delete(Storage.CurrentContext, randomnessKey);

            OnWinnerDrawn(claimedWinner, prize, roundId);
            OnRoundCompleted(roundId, claimedWinner, prize, totalTickets);

            return true;
        }

        /// <summary>
        /// Verify that claimed winner owns the winning ticket.
        /// Uses O(1) verification instead of O(n) search.
        /// </summary>
        private static bool VerifyWinnerOwnsTicket(
            BigInteger roundId,
            UInt160 claimedWinner,
            BigInteger claimedIndex,
            BigInteger winningTicket)
        {
            BigInteger participantCount = GetParticipantCount(roundId);
            if (claimedIndex < 0 || claimedIndex >= participantCount)
                return false;

            // Get participant at claimed index
            byte[] participantKey = Helper.Concat(
                PREFIX_PARTICIPANTS,
                (ByteString)roundId.ToByteArray());
            participantKey = Helper.Concat(
                participantKey,
                (ByteString)claimedIndex.ToByteArray());
            UInt160 participant = (UInt160)Storage.Get(
                Storage.CurrentContext, participantKey);

            if (participant != claimedWinner) return false;

            // Calculate cumulative sum up to this participant
            BigInteger cumulativeBefore = 0;
            for (BigInteger i = 0; i < claimedIndex; i++)
            {
                byte[] pKey = Helper.Concat(
                    PREFIX_PARTICIPANTS,
                    (ByteString)roundId.ToByteArray());
                pKey = Helper.Concat(pKey, (ByteString)i.ToByteArray());
                UInt160 p = (UInt160)Storage.Get(Storage.CurrentContext, pKey);

                byte[] tKey = Helper.Concat(PREFIX_TICKETS, p);
                tKey = Helper.Concat(tKey, (ByteString)roundId.ToByteArray());
                cumulativeBefore += (BigInteger)Storage.Get(
                    Storage.CurrentContext, tKey);
            }

            // Get this participant's tickets
            byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, claimedWinner);
            ticketKey = Helper.Concat(
                ticketKey,
                (ByteString)roundId.ToByteArray());
            BigInteger tickets = (BigInteger)Storage.Get(
                Storage.CurrentContext, ticketKey);

            BigInteger cumulativeAfter = cumulativeBefore + tickets;

            // Winning ticket must be in range [cumulativeBefore, cumulativeAfter)
            return winningTicket >= cumulativeBefore &&
                   winningTicket < cumulativeAfter;
        }

        #region Events

        public delegate void DrawRandomnessStoredHandler(
            BigInteger roundId,
            ByteString randomness);

        [DisplayName("DrawRandomnessStored")]
        public static event DrawRandomnessStoredHandler OnDrawRandomnessStored;

        #endregion

        #endregion

        #region Two-Phase Scratch Ticket

        /// <summary>
        /// Get scratch lottery config for frontend prize calculation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetScratchConfigForFrontend(byte lotteryType)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            Map<string, object> result = new Map<string, object>();

            result["enabled"] = config.Enabled;
            result["isInstant"] = config.IsInstant;
            result["ticketPrice"] = config.TicketPrice;
            result["prizePool"] = config.PrizePool;

            // Prize tiers for frontend calculation
            result["jackpotRate"] = config.JackpotRate;
            result["tier1Rate"] = config.Tier1Rate;
            result["tier2Rate"] = config.Tier2Rate;
            result["tier3Rate"] = config.Tier3Rate;

            result["jackpotPrize"] = config.JackpotPrize;
            result["tier1Prize"] = config.Tier1Prize;
            result["tier2Prize"] = config.Tier2Prize;
            result["tier3Prize"] = config.Tier3Prize;

            return result;
        }

        /// <summary>
        /// Phase 1: Buy scratch ticket - returns seed for TEE calculation.
        /// TEE calculates prize using seed, then calls RevealWithCalculation.
        /// Uses MiniAppComputeBase script registration for verification.
        /// </summary>
        public static object[] BuyScratchTicketHybrid(
            UInt160 player,
            byte lotteryType,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(player);

            // Verify script is registered and enabled
            ExecutionEngine.Assert(
                IsScriptEnabled(SCRIPT_SCRATCH_PRIZE),
                "scratch script not registered");

            LotteryConfig config = GetLotteryConfig(lotteryType);
            ExecutionEngine.Assert(config.Enabled, "lottery type disabled");
            ExecutionEngine.Assert(config.IsInstant, "not instant lottery");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid
                && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, config.TicketPrice, receiptId);

            BigInteger ticketId = GetNextScratchId();

            // Generate seed using MiniAppComputeBase method
            ByteString seed = GenerateOperationSeed(ticketId, player, SCRIPT_SCRATCH_PRIZE);

            // Store ticket without prize (prize calculated by TEE)
            ScratchTicket ticket = new ScratchTicket
            {
                Id = ticketId,
                Player = player,
                Type = lotteryType,
                PurchaseTime = Runtime.Time,
                Scratched = false,
                Prize = 0,  // Will be set in RevealWithCalculation
                Seed = 0    // Seed stored via GenerateOperationSeed
            };
            StoreScratchTicket(ticketId, ticket);

            AddPlayerScratchTicket(player, ticketId);
            UpdateTypePoolStats(lotteryType, config.TicketPrice);

            OnScratchTicketInitiated(player, ticketId, lotteryType, seed);

            return new object[] { ticketId, seed, SCRIPT_SCRATCH_PRIZE };
        }

        /// <summary>
        /// Phase 2: Reveal with TEE-calculated prize.
        /// Contract verifies script hash and prize calculation.
        /// </summary>
        public static Map<string, object> RevealScratchWithCalculation(
            UInt160 player,
            BigInteger ticketId,
            BigInteger calculatedPrize,
            ByteString scriptHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(player);

            // Verify script hash matches registered script
            ValidateScriptHash(SCRIPT_SCRATCH_PRIZE, scriptHash);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid
                && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ScratchTicket ticket = GetScratchTicket(ticketId);
            ExecutionEngine.Assert(ticket.Id > 0, "ticket not found");
            ExecutionEngine.Assert(ticket.Player == player, "not ticket owner");
            ExecutionEngine.Assert(!ticket.Scratched, "already scratched");

            // Get stored seed from MiniAppComputeBase
            ByteString storedSeed = GetOperationSeed(ticketId);
            ExecutionEngine.Assert(storedSeed != null, "seed not found");

            // Verify prize calculation
            BigInteger expectedPrize = CalculatePrizeFromSeed(ticket.Type, storedSeed);
            ExecutionEngine.Assert(calculatedPrize == expectedPrize, "prize mismatch");

            // Update ticket
            ticket.Scratched = true;
            ticket.Prize = calculatedPrize;
            StoreScratchTicket(ticketId, ticket);

            // Clean up seed using MiniAppComputeBase method
            DeleteOperationSeed(ticketId);

            bool isWinner = calculatedPrize > 0;

            if (isWinner)
            {
                bool transferred = GAS.Transfer(
                    Runtime.ExecutingScriptHash, player, calculatedPrize);
                ExecutionEngine.Assert(transferred, "payout failed");
                UpdateScratchWinStats(player, ticket.Type, calculatedPrize);
            }

            OnScratchTicketRevealed(player, ticketId, calculatedPrize, isWinner);

            Map<string, object> result = new Map<string, object>();
            result["ticketId"] = ticketId;
            result["lotteryType"] = ticket.Type;
            result["isWinner"] = isWinner;
            result["prize"] = calculatedPrize;
            result["purchaseTime"] = ticket.PurchaseTime;

            return result;
        }

        /// <summary>
        /// Calculate prize from seed (exposed for TEE/frontend verification).
        /// </summary>
        [Safe]
        public static BigInteger CalculatePrizeFromSeed(byte lotteryType, ByteString seed)
        {
            ByteString hash = CryptoLib.Sha256(seed);
            byte[] hashBytes = (byte[])hash;

            BigInteger seedNumber = 0;
            for (int i = 0; i < 8; i++)
            {
                seedNumber = seedNumber * 256 + hashBytes[i];
            }

            return CalculatePrize(lotteryType, seedNumber);
        }

        // Event for two-phase scratch
        public static event Action<UInt160, BigInteger, byte, ByteString> OnScratchTicketInitiated;

        #endregion

    }
}
