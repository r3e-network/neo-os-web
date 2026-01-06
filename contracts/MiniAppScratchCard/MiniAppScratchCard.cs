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
    public delegate void CardPurchasedHandler(UInt160 player, BigInteger cardType, BigInteger cost, BigInteger cardId);
    public delegate void CardRevealedHandler(UInt160 player, BigInteger cardType, BigInteger prize, BigInteger cardId);
    public delegate void RngRequestedHandler(BigInteger cardId, BigInteger requestId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Scratch Card MiniApp - Instant win cards with VRF randomness.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - User invokes BuyCard → Contract requests RNG from ServiceLayerGateway
    /// - Gateway fulfills request → Contract receives callback → Reveals prize
    ///
    /// PRIZE MECHANICS:
    /// - 20% chance to win: prize = cost × cardType × 2 (minus 5% fee)
    /// - 80% chance: no prize
    /// - Higher card types give higher potential prizes
    /// </summary>
    [DisplayName("MiniAppScratchCard")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. ScratchCard is an instant-win gaming application for scratch card prizes. Use it to purchase and reveal scratch cards, you can win instant prizes with provable randomness.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-scratchcard";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const int WIN_THRESHOLD = 20; // 20% win chance
        private const long MIN_BET = 5000000;    // 0.05 GAS
        private const long MAX_BET = 5000000000; // 50 GAS (anti-Martingale)
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_CARD_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CARDS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_CARD = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Card Data Structure
        public struct CardData
        {
            public UInt160 Player;
            public BigInteger CardType;
            public BigInteger Cost;
            public BigInteger Timestamp;
            public bool Revealed;
        }
        #endregion

        #region App Events
        [DisplayName("CardPurchased")]
        public static event CardPurchasedHandler OnCardPurchased;

        [DisplayName("CardRevealed")]
        public static event CardRevealedHandler OnCardRevealed;

        [DisplayName("RngRequested")]
        public static event RngRequestedHandler OnRngRequested;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (!update)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
                Storage.Put(Storage.CurrentContext, PREFIX_CARD_ID, 0);
            }
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger BuyCard(UInt160 player, BigInteger cardType, BigInteger cost, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(cardType >= 1 && cardType <= 5, "invalid card type");
            ExecutionEngine.Assert(cost >= MIN_BET, "min cost 0.05 GAS");
            ExecutionEngine.Assert(cost <= MAX_BET, "max cost 50 GAS (anti-Martingale)");

            // Anti-Martingale protection
            ValidateBetLimits(player, cost);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, cost, receiptId);

            BigInteger cardId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CARD_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CARD_ID, cardId);

            CardData card = new CardData
            {
                Player = player,
                CardType = cardType,
                Cost = cost,
                Timestamp = Runtime.Time,
                Revealed = false
            };
            StoreCard(cardId, card);

            BigInteger requestId = RequestRng(cardId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_CARD, (ByteString)requestId.ToByteArray()),
                cardId);

            OnCardPurchased(player, cardType, cost, cardId);
            OnRngRequested(cardId, requestId);
            return cardId;
        }

        [Safe]
        public static CardData GetCard(BigInteger cardId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_CARDS, (ByteString)cardId.ToByteArray()));
            if (data == null) return new CardData();
            return (CardData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger cardId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { cardId });
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

            ByteString cardIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_CARD, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(cardIdData != null, "unknown request");

            BigInteger cardId = (BigInteger)cardIdData;
            CardData card = GetCard(cardId);
            ExecutionEngine.Assert(!card.Revealed, "already revealed");
            ExecutionEngine.Assert(card.Player != null, "card not found");

            if (!success)
            {
                card.Revealed = true;
                StoreCard(cardId, card);
                OnCardRevealed(card.Player, card.CardType, 0, cardId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");
            byte[] randomBytes = (byte[])result;
            BigInteger rand = randomBytes[0] % 100;
            BigInteger prize = rand < WIN_THRESHOLD
                ? card.Cost * card.CardType * 2 * (100 - PLATFORM_FEE_PERCENT) / 100
                : 0;

            card.Revealed = true;
            StoreCard(cardId, card);
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_CARD, (ByteString)requestId.ToByteArray()));

            OnCardRevealed(card.Player, card.CardType, prize, cardId);
        }

        #endregion

        #region Internal Helpers

        private static void StoreCard(BigInteger cardId, CardData card)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_CARDS, (ByteString)cardId.ToByteArray()),
                StdLib.Serialize(card));
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
        /// LOGIC: Manages prize pool and card distribution.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated prize pool management
            ProcessAutomatedPrizePool();
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
        /// Internal method to manage prize pool.
        /// Called by OnPeriodicExecution.
        /// Monitors prize distribution and maintains pool balance.
        /// </summary>
        private static void ProcessAutomatedPrizePool()
        {
            // In a production implementation, this would monitor the prize pool
            // and perform maintenance tasks such as:
            // - Rebalancing the pool based on win/loss ratios
            // - Adjusting card probabilities dynamically
            // - Managing reserve funds

            // Example: Check current card count and pool status
            BigInteger currentCardId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CARD_ID);

            // In production, implement prize pool analytics and management logic
            // For demonstration purposes, we skip the detailed logic here
        }

        #endregion
    }
}
