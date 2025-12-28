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
    public delegate void TableCreatedHandler(BigInteger tableId, UInt160 creator, BigInteger buyIn);
    public delegate void PlayerJoinedHandler(BigInteger tableId, UInt160 player, BigInteger seat);
    public delegate void HandStartedHandler(BigInteger tableId, BigInteger handId, BigInteger requestId);
    public delegate void HandResultHandler(BigInteger tableId, BigInteger handId, UInt160 winner, BigInteger pot);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
    public delegate void TableTimeoutHandler(BigInteger tableId);

    /// <summary>
    /// Secret Poker - TEE Texas Hold'em with confidential dealing.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Creator creates table via CreateTable
    /// - Players join via JoinTable
    /// - StartHand → Contract requests TEE for encrypted deck
    /// - TEE deals cards privately to each player
    /// - ResolveHand → TEE reveals cards and determines winner
    ///
    /// MECHANICS:
    /// - Cards encrypted with player-specific keys
    /// - Only TEE knows full deck state
    /// - Fair shuffle verified via VRF seed
    /// </summary>
    [DisplayName("MiniAppSecretPoker")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Secret Poker - TEE Texas Hold'em with confidential dealing")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-secretpoker";
        private const long MIN_BUY_IN = 100000000; // 1 GAS
        private const int MAX_PLAYERS = 9;
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_TABLE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TABLES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_HAND_ID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_HANDS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_REQUEST_TO_HAND = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_PLAYERS = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct TableData
        {
            public UInt160 Creator;
            public BigInteger BuyIn;
            public BigInteger PlayerCount;
            public bool Active;
            public BigInteger CurrentHand;
            public BigInteger LastActivityTime;
        }

        public struct HandData
        {
            public BigInteger TableId;
            public BigInteger Pot;
            public bool Resolved;
            public UInt160 Winner;
        }
        #endregion

        #region App Events
        [DisplayName("TableCreated")]
        public static event TableCreatedHandler OnTableCreated;

        [DisplayName("PlayerJoined")]
        public static event PlayerJoinedHandler OnPlayerJoined;

        [DisplayName("HandStarted")]
        public static event HandStartedHandler OnHandStarted;

        [DisplayName("HandResult")]
        public static event HandResultHandler OnHandResult;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;

        [DisplayName("TableTimeout")]
        public static event TableTimeoutHandler OnTableTimeout;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TABLE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_HAND_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateTable(UInt160 creator, BigInteger buyIn)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(buyIn >= MIN_BUY_IN, "min buy-in 1 GAS");

            BigInteger tableId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TABLE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TABLE_ID, tableId);

            TableData table = new TableData
            {
                Creator = creator,
                BuyIn = buyIn,
                PlayerCount = 0,
                Active = true,
                CurrentHand = 0,
                LastActivityTime = Runtime.Time
            };
            StoreTable(tableId, table);

            OnTableCreated(tableId, creator, buyIn);
            return tableId;
        }

        public static BigInteger JoinTable(BigInteger tableId, UInt160 player)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");

            TableData table = GetTable(tableId);
            ExecutionEngine.Assert(table.Creator != null, "table not found");
            ExecutionEngine.Assert(table.Active, "table inactive");
            ExecutionEngine.Assert(table.PlayerCount < MAX_PLAYERS, "table full");

            BigInteger seat = table.PlayerCount + 1;
            table.PlayerCount = seat;
            table.LastActivityTime = Runtime.Time;
            StoreTable(tableId, table);

            // Store player at seat
            ByteString playerKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_PLAYERS, (ByteString)tableId.ToByteArray()),
                (ByteString)seat.ToByteArray());
            Storage.Put(Storage.CurrentContext, playerKey, player);

            OnPlayerJoined(tableId, player, seat);
            return seat;
        }

        /// <summary>
        /// Start a new hand - requests TEE to shuffle and deal.
        /// </summary>
        public static BigInteger StartHand(BigInteger tableId)
        {
            TableData table = GetTable(tableId);
            ExecutionEngine.Assert(table.Creator != null, "table not found");
            ExecutionEngine.Assert(table.Active, "table inactive");
            ExecutionEngine.Assert(table.PlayerCount >= 2, "need 2+ players");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(table.Creator) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );

            BigInteger handId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_HAND_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_HAND_ID, handId);

            HandData hand = new HandData
            {
                TableId = tableId,
                Pot = table.BuyIn * table.PlayerCount,
                Resolved = false,
                Winner = UInt160.Zero
            };
            StoreHand(handId, hand);

            table.CurrentHand = handId;
            table.LastActivityTime = Runtime.Time;
            StoreTable(tableId, table);

            // Request TEE to shuffle deck and deal cards
            BigInteger requestId = RequestTeeCompute(handId, tableId, table.PlayerCount);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_HAND, (ByteString)requestId.ToByteArray()),
                handId);

            OnHandStarted(tableId, handId, requestId);
            return handId;
        }

        [Safe]
        public static TableData GetTable(BigInteger tableId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_TABLES, (ByteString)tableId.ToByteArray()));
            if (data == null) return new TableData();
            return (TableData)StdLib.Deserialize(data);
        }

        [Safe]
        public static HandData GetHand(BigInteger handId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_HANDS, (ByteString)handId.ToByteArray()));
            if (data == null) return new HandData();
            return (HandData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestTeeCompute(BigInteger handId, BigInteger tableId, BigInteger playerCount)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { handId, tableId, playerCount });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "tee-compute", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString handIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_HAND, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(handIdData != null, "unknown request");

            BigInteger handId = (BigInteger)handIdData;
            HandData hand = GetHand(handId);
            ExecutionEngine.Assert(!hand.Resolved, "already resolved");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_HAND, (ByteString)requestId.ToByteArray()));

            hand.Resolved = true;

            if (success && result != null && result.Length > 0)
            {
                // Result format: [winnerAddress, finalPot]
                object[] handResult = (object[])StdLib.Deserialize(result);
                hand.Winner = (UInt160)handResult[0];
                hand.Pot = (BigInteger)handResult[1];
            }

            StoreHand(handId, hand);

            OnHandResult(hand.TableId, handId, hand.Winner, hand.Pot);
        }

        #endregion

        #region Internal Helpers

        private static void StoreTable(BigInteger tableId, TableData table)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_TABLES, (ByteString)tableId.ToByteArray()),
                StdLib.Serialize(table));
        }

        private static void StoreHand(BigInteger handId, HandData hand)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_HANDS, (ByteString)handId.ToByteArray()),
                StdLib.Serialize(hand));
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
        /// LOGIC: Handles inactive game tables (timeout after inactivity).
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated timeout for inactive tables
            ProcessAutomatedTimeout();
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
        /// Internal method to process automated timeout for inactive tables.
        /// Called by OnPeriodicExecution.
        /// Timeout period: 1 hour (3600000 ms) of inactivity.
        /// </summary>
        private static void ProcessAutomatedTimeout()
        {
            const ulong TIMEOUT_PERIOD = 3600000; // 1 hour in milliseconds

            // Iterate through recent tables to check for inactivity
            BigInteger currentTableId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TABLE_ID);
            BigInteger startId = currentTableId > 10 ? currentTableId - 10 : 1;

            for (BigInteger tableId = startId; tableId <= currentTableId; tableId++)
            {
                TableData table = GetTable(tableId);

                // Skip if table doesn't exist or already inactive
                if (table.Creator == null || !table.Active)
                {
                    continue;
                }

                // Check if table is inactive for more than timeout period
                if (Runtime.Time > (ulong)table.LastActivityTime + TIMEOUT_PERIOD)
                {
                    // Mark table as inactive
                    table.Active = false;
                    StoreTable(tableId, table);

                    OnTableTimeout(tableId);
                }
            }
        }

        #endregion
    }
}
