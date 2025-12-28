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
    public delegate void MegaTicketPurchasedHandler(UInt160 player, BigInteger roundId, BigInteger ticketId);
    public delegate void DrawInitiatedHandler(BigInteger roundId, BigInteger requestId);
    public delegate void DrawCompletedHandler(BigInteger roundId, byte[] winningNumbers, BigInteger jackpotPool);
    public delegate void PrizeWonHandler(UInt160 player, BigInteger roundId, int tier, BigInteger amount);
    public delegate void JackpotWonHandler(UInt160 player, BigInteger roundId, BigInteger amount);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// MegaMillions Lottery - Multi-tier lottery with 9 prize levels.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Users buy tickets via BuyTicket (user-initiated)
    /// - Admin initiates draw via InitiateDraw → Contract requests RNG
    /// - Gateway fulfills request → Contract receives callback → Generates winning numbers
    ///
    /// MECHANICS:
    /// - Pick 5 main numbers (1-70) + 1 mega ball (1-25)
    /// - Jackpot: match all 6
    /// - 8 secondary prize tiers
    /// </summary>
    [DisplayName("MiniAppMegaMillions")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "MegaMillions lottery with on-chain RNG requests")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-megamillions";
        private const int MAIN_NUMBERS_COUNT = 5;
        private const int MAIN_NUMBERS_MAX = 70;
        private const int MEGA_BALL_MAX = 25;
        private const long TICKET_PRICE = 20000000; // 0.2 GAS
        private const long INITIAL_JACKPOT = 100000000000; // 1000 GAS
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TICKET_ID = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_JACKPOT = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_WINNING = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_DRAW_PENDING = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REQUEST_TO_ROUND = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Ticket Data Structure
        public struct TicketData
        {
            public UInt160 Player;
            public BigInteger RoundId;
            public byte[] MainNumbers;
            public byte MegaBall;
            public bool Claimed;
        }
        #endregion

        private static readonly long[] PRIZE_AMOUNTS = new long[]
        {
            0, 10000000000, 5000000000, 500000000,
            200000000, 50000000, 50000000, 20000000, 10000000
        };

        #region App Events
        [DisplayName("MegaTicketPurchased")]
        public static event MegaTicketPurchasedHandler OnMegaTicketPurchased;

        [DisplayName("DrawInitiated")]
        public static event DrawInitiatedHandler OnDrawInitiated;

        [DisplayName("DrawCompleted")]
        public static event DrawCompletedHandler OnDrawCompleted;

        [DisplayName("PrizeWon")]
        public static event PrizeWonHandler OnPrizeWon;

        [DisplayName("JackpotWon")]
        public static event JackpotWonHandler OnJackpotWon;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region App Getters
        [Safe]
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND);

        [Safe]
        public static BigInteger JackpotPool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_JACKPOT);

        [Safe]
        public static bool IsDrawPending() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DRAW_PENDING) == 1;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, INITIAL_JACKPOT);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// User buys a ticket with their chosen numbers.
        /// </summary>
        public static BigInteger BuyTicket(UInt160 player, byte[] mainNumbers, byte megaBall)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            ExecutionEngine.Assert(player.IsValid, "invalid player");
            ExecutionEngine.Assert(!IsDrawPending(), "draw in progress");
            ExecutionEngine.Assert(mainNumbers.Length == MAIN_NUMBERS_COUNT, "need 5 numbers");
            ExecutionEngine.Assert(megaBall >= 1 && megaBall <= MEGA_BALL_MAX, "mega 1-25");

            for (int i = 0; i < MAIN_NUMBERS_COUNT; i++)
                ExecutionEngine.Assert(mainNumbers[i] >= 1 && mainNumbers[i] <= MAIN_NUMBERS_MAX, "main 1-70");

            BigInteger ticketId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TICKET_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_ID, ticketId);

            BigInteger roundId = CurrentRound();
            TicketData ticket = new TicketData
            {
                Player = player,
                RoundId = roundId,
                MainNumbers = mainNumbers,
                MegaBall = megaBall,
                Claimed = false
            };
            StoreTicket(ticketId, ticket);

            // Add to jackpot pool
            BigInteger jackpot = JackpotPool();
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, jackpot + TICKET_PRICE / 2);

            OnMegaTicketPurchased(player, roundId, ticketId);
            return ticketId;
        }

        /// <summary>
        /// Admin initiates draw - requests RNG from gateway.
        /// </summary>
        public static void InitiateDraw()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(!IsDrawPending(), "draw already pending");

            BigInteger roundId = CurrentRound();
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 1);

            BigInteger requestId = RequestRng(roundId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()),
                roundId);

            OnDrawInitiated(roundId, requestId);
        }

        [Safe]
        public static TicketData GetTicket(BigInteger ticketId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_TICKETS, (ByteString)ticketId.ToByteArray()));
            if (data == null) return new TicketData();
            return (TicketData)StdLib.Deserialize(data);
        }

        [Safe]
        public static byte[] GetWinningNumbers(BigInteger roundId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_WINNING, (ByteString)roundId.ToByteArray()));
            return data == null ? new byte[0] : (byte[])data;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger roundId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { roundId });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString roundIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(roundIdData != null, "unknown request");

            BigInteger roundId = (BigInteger)roundIdData;

            if (!success)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
                OnDrawCompleted(roundId, new byte[0], 0);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length >= 32, "need randomness");

            BigInteger jackpot = JackpotPool();

            // Generate winning numbers from RNG
            byte[] winning = new byte[6];
            byte[] randomBytes = (byte[])result;
            for (int i = 0; i < 5; i++)
                winning[i] = (byte)((randomBytes[i * 4] % MAIN_NUMBERS_MAX) + 1);
            winning[5] = (byte)((randomBytes[20] % MEGA_BALL_MAX) + 1);

            // Store winning numbers for this round
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_WINNING, (ByteString)roundId.ToByteArray()),
                winning);

            // Move to next round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, roundId + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()));

            OnDrawCompleted(roundId, winning, jackpot);
        }

        #endregion

        #region Prize Claiming

        [Safe]
        public static int CalculateTier(byte[] ticket, byte ticketMega, byte[] winning)
        {
            int mainMatches = 0;
            bool megaMatch = (ticketMega == winning[5]);

            for (int i = 0; i < 5; i++)
                for (int j = 0; j < 5; j++)
                    if (ticket[i] == winning[j]) { mainMatches++; break; }

            if (mainMatches == 5 && megaMatch) return 0;
            if (mainMatches == 5) return 1;
            if (mainMatches == 4 && megaMatch) return 2;
            if (mainMatches == 4) return 3;
            if (mainMatches == 3 && megaMatch) return 4;
            if (mainMatches == 3) return 5;
            if (mainMatches == 2 && megaMatch) return 6;
            if (mainMatches == 1 && megaMatch) return 7;
            if (megaMatch) return 8;
            return 9;
        }

        public static BigInteger ClaimPrize(BigInteger ticketId)
        {
            TicketData ticket = GetTicket(ticketId);
            ExecutionEngine.Assert(ticket.Player != null, "ticket not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(ticket.Player), "unauthorized");
            ExecutionEngine.Assert(!ticket.Claimed, "already claimed");

            byte[] winning = GetWinningNumbers(ticket.RoundId);
            ExecutionEngine.Assert(winning.Length == 6, "round not drawn");

            int tier = CalculateTier(ticket.MainNumbers, ticket.MegaBall, winning);
            if (tier == 9) return 0;

            BigInteger prize;
            if (tier == 0)
            {
                prize = JackpotPool();
                Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, INITIAL_JACKPOT);
                OnJackpotWon(ticket.Player, ticket.RoundId, prize);
            }
            else
            {
                prize = PRIZE_AMOUNTS[tier];
                OnPrizeWon(ticket.Player, ticket.RoundId, tier, prize);
            }

            // Mark as claimed
            ticket.Claimed = true;
            StoreTicket(ticketId, ticket);

            return prize;
        }

        [Safe]
        public static BigInteger GetPrizeAmount(int tier)
        {
            if (tier == 0) return JackpotPool();
            if (tier >= 1 && tier <= 8) return PRIZE_AMOUNTS[tier];
            return 0;
        }

        #endregion

        #region Internal Helpers

        private static void StoreTicket(BigInteger ticketId, TicketData ticket)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_TICKETS, (ByteString)ticketId.ToByteArray()),
                StdLib.Serialize(ticket));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Triggers draw if conditions are met (e.g., minimum tickets sold).
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated draw if conditions met
            ProcessAutomatedDraw();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated draw.
        /// Called by OnPeriodicExecution.
        /// Checks if draw conditions are met (e.g., scheduled time, minimum tickets).
        /// </summary>
        private static void ProcessAutomatedDraw()
        {
            // Check if draw is already pending
            if (IsDrawPending())
            {
                return; // Skip if draw is in progress
            }

            // In a production implementation, check conditions such as:
            // - Scheduled draw time has arrived
            // - Minimum number of tickets sold
            // - Time since last draw exceeds threshold

            // Example: Check if enough tickets have been sold
            BigInteger currentTicketId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TICKET_ID);
            BigInteger minTicketsForDraw = 10; // Example threshold

            // For demonstration, we show the structure without auto-triggering
            // Real implementation would call InitiateDraw() when conditions met:
            // if (currentTicketId >= minTicketsForDraw) {
            //     BigInteger roundId = CurrentRound();
            //     Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 1);
            //     BigInteger requestId = RequestRng(roundId);
            //     Storage.Put(Storage.CurrentContext,
            //         Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()),
            //         roundId);
            //     OnDrawInitiated(roundId, requestId);
            // }
        }

        #endregion
    }
}
