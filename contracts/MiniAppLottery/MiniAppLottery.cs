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
    public delegate void TicketPurchasedHandler(UInt160 player, BigInteger ticketCount, BigInteger roundId);
    public delegate void DrawInitiatedHandler(BigInteger roundId, BigInteger requestId);
    public delegate void WinnerDrawnHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Lottery MiniApp with provable VRF randomness.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Users buy tickets via BuyTickets
    /// - Admin initiates draw via InitiateDraw → Contract requests RNG
    /// - Gateway fulfills request → Contract receives callback → Selects winner
    ///
    /// MECHANICS:
    /// - Ticket price: 0.1 GAS
    /// - Platform fee: 10%
    /// - Winner takes 90% of prize pool
    /// </summary>
    [DisplayName("MiniAppLottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. Lottery is a jackpot gaming application for prize pool betting. Use it to buy lottery tickets, you can win massive jackpot prizes through provable random draws.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-lottery";
        private const long TICKET_PRICE = 10000000; // 0.1 GAS
        private const int PLATFORM_FEE_PERCENT = 10;
        private const int MAX_TICKETS_PER_TX = 100;  // Max 100 tickets per transaction (anti-Martingale)
        private const int MAX_TICKETS_PER_ROUND = 500; // Max 500 tickets per player per round
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TICKET_COUNT = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_PARTICIPANTS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_DRAW_PENDING = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REQUEST_TO_ROUND = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region App Events
        [DisplayName("TicketPurchased")]
        public static event TicketPurchasedHandler OnTicketPurchased;

        [DisplayName("DrawInitiated")]
        public static event DrawInitiatedHandler OnDrawInitiated;

        [DisplayName("WinnerDrawn")]
        public static event WinnerDrawnHandler OnWinnerDrawn;

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
        public static BigInteger PrizePool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        [Safe]
        public static BigInteger TotalTickets() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TICKET_COUNT);

        [Safe]
        public static bool IsDrawPending() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DRAW_PENDING) == 1;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
        }
        #endregion

        #region User-Facing Methods

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

            // Anti-Martingale: Validate bet limits
            ValidateBetLimits(player, totalCost);

            ValidatePaymentReceipt(APP_ID, player, totalCost, receiptId);

            // Update player tickets
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

            OnTicketPurchased(player, ticketCount, roundId);
        }

        /// <summary>
        /// Admin initiates draw - requests RNG from gateway.
        /// </summary>
        public static void InitiateDraw()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(!IsDrawPending(), "draw already pending");

            BigInteger pool = PrizePool();
            ExecutionEngine.Assert(pool > 0, "no prize pool");

            BigInteger roundId = CurrentRound();
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 1);

            BigInteger requestId = RequestRng(roundId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()),
                roundId);

            OnDrawInitiated(roundId, requestId);
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
                OnWinnerDrawn(UInt160.Zero, 0, roundId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");

            BigInteger pool = PrizePool();
            BigInteger prize = pool * (100 - PLATFORM_FEE_PERCENT) / 100;
            BigInteger totalTickets = TotalTickets();

            // Select winner based on RNG
            UInt160 winner = SelectWinner(roundId, result, totalTickets);

            // Reset for next round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, roundId + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TICKET_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()));

            OnWinnerDrawn(winner, prize, roundId);
        }

        #endregion

        #region Internal Helpers

        private static UInt160 SelectWinner(BigInteger roundId, ByteString randomness, BigInteger totalTickets)
        {
            if (totalTickets == 0) return Admin();

            byte[] randomBytes = (byte[])randomness;
            BigInteger winningTicket = 0;
            for (int i = 0; i < randomBytes.Length && i < 8; i++)
            {
                winningTicket = winningTicket * 256 + randomBytes[i];
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

        private static BigInteger GetParticipantCount(BigInteger roundId)
        {
            byte[] key = Helper.Concat(new byte[] { 0x17 }, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void SetParticipantCount(BigInteger roundId, BigInteger count)
        {
            byte[] key = Helper.Concat(new byte[] { 0x17 }, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, count);
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
        /// LOGIC: Checks if current round has tickets; if yes, initiates draw.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Check if draw is already pending
            if (IsDrawPending())
            {
                return; // Skip if draw is in progress
            }

            // Check if there are tickets in the current round
            BigInteger pool = PrizePool();
            if (pool == 0)
            {
                return; // No tickets, skip draw
            }

            // Initiate draw
            BigInteger roundId = CurrentRound();
            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 1);

            BigInteger requestId = RequestRng(roundId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ROUND, (ByteString)requestId.ToByteArray()),
                roundId);

            OnDrawInitiated(roundId, requestId);
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

        #endregion
    }
}
