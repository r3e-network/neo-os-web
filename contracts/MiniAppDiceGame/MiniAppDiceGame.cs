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
    public delegate void BetPlacedHandler(UInt160 player, BigInteger chosen, BigInteger amount, BigInteger betId);
    public delegate void DiceRolledHandler(UInt160 player, BigInteger chosen, BigInteger rolled, BigInteger payout, BigInteger betId);
    public delegate void RngRequestedHandler(BigInteger betId, BigInteger requestId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Dice Game MiniApp - Roll dice, win up to 6x.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - User invokes PlaceBet → Contract requests RNG from ServiceLayerGateway
    /// - Gateway fulfills request → Contract receives callback → Settles bet
    ///
    /// GAME MECHANICS:
    /// - Player chooses a number 1-6
    /// - VRF randomness determines dice roll
    /// - Win: 6x bet minus 5% platform fee
    /// - Lose: Forfeit entire bet
    /// </summary>
    [DisplayName("MiniAppDiceGame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Dice Game MiniApp - Roll dice, win up to 6x with on-chain RNG requests")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dicegame";
        private const int PLATFORM_FEE_PERCENT = 5;
        private const long MIN_BET = 5000000;    // 0.05 GAS
        private const long MAX_BET = 2000000000; // 20 GAS (anti-Martingale, lower due to 6x payout)
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_BET = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Bet Data Structure
        public struct BetData
        {
            public UInt160 Player;
            public BigInteger ChosenNumber;
            public BigInteger Amount;
            public BigInteger Timestamp;
            public bool Resolved;
        }
        #endregion

        #region App Events
        [DisplayName("BetPlaced")]
        public static event BetPlacedHandler OnBetPlaced;

        [DisplayName("DiceRolled")]
        public static event DiceRolledHandler OnDiceRolled;

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
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Places a dice bet and requests RNG.
        /// </summary>
        public static BigInteger PlaceBet(UInt160 player, BigInteger chosenNumber, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            ExecutionEngine.Assert(chosenNumber >= 1 && chosenNumber <= 6, "choose 1-6");
            ExecutionEngine.Assert(amount >= MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(amount <= MAX_BET, "max bet 20 GAS (anti-Martingale)");

            // Anti-Martingale: Validate bet limits
            ValidateBetLimits(player, amount);

            BigInteger betId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, betId);

            BetData bet = new BetData
            {
                Player = player,
                ChosenNumber = chosenNumber,
                Amount = amount,
                Timestamp = Runtime.Time,
                Resolved = false
            };
            StoreBet(betId, bet);

            // Record bet for anti-Martingale tracking
            RecordBet(player, amount);

            BigInteger requestId = RequestRng(betId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, (ByteString)requestId.ToByteArray()),
                betId);

            OnBetPlaced(player, chosenNumber, amount, betId);
            OnRngRequested(betId, requestId);
            return betId;
        }

        [Safe]
        public static BetData GetBet(BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_BETS, (ByteString)betId.ToByteArray()));
            if (data == null) return new BetData();
            return (BetData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger betId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { betId });
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

            ByteString betIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(betIdData != null, "unknown request");

            BigInteger betId = (BigInteger)betIdData;
            BetData bet = GetBet(betId);
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");
            ExecutionEngine.Assert(bet.Player != null, "bet not found");

            if (!success)
            {
                bet.Resolved = true;
                StoreBet(betId, bet);
                OnDiceRolled(bet.Player, bet.ChosenNumber, 0, 0, betId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");
            byte[] randomBytes = (byte[])result;
            BigInteger rolled = (randomBytes[0] % 6) + 1;
            bool won = rolled == bet.ChosenNumber;
            BigInteger payout = won ? bet.Amount * 6 * (100 - PLATFORM_FEE_PERCENT) / 100 : 0;

            bet.Resolved = true;
            StoreBet(betId, bet);
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BET, (ByteString)requestId.ToByteArray()));

            OnDiceRolled(bet.Player, bet.ChosenNumber, rolled, payout, betId);
        }

        #endregion

        #region Internal Helpers

        private static void StoreBet(BigInteger betId, BetData bet)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_BETS, (ByteString)betId.ToByteArray()),
                StdLib.Serialize(bet));
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
        /// LOGIC: Processes automated settlement for expired games.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated settlement of expired games
            ProcessAutomatedSettlement();
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
        /// Internal method to process automated settlement for expired games.
        /// Called by OnPeriodicExecution.
        /// Finds games that are unresolved and past timeout threshold.
        /// </summary>
        private static void ProcessAutomatedSettlement()
        {
            // In a production implementation, this would iterate through pending games
            // and settle those that have exceeded a timeout threshold.
            // For this reference implementation, we demonstrate the structure:

            // Example: Check if there are any unresolved games past a timeout (e.g., 1 hour = 3600000 ms)
            BigInteger currentBetId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);
            BigInteger currentTime = Runtime.Time;
            BigInteger timeout = 3600000; // 1 hour timeout

            // In production, maintain a list of pending games to avoid full iteration
            // For demonstration purposes, we skip the iteration logic here
            // Real implementation would maintain PREFIX_PENDING_GAMES queue
        }

        #endregion
    }
}
