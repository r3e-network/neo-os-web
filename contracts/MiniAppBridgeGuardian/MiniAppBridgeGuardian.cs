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
    public delegate void BridgeInitiatedHandler(UInt160 user, string targetChain, BigInteger amount, BigInteger bridgeId);
    public delegate void VerificationRequestedHandler(BigInteger bridgeId, BigInteger requestId);
    public delegate void BridgeCompletedHandler(UInt160 user, string targetChain, BigInteger amount, bool success, BigInteger bridgeId);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Bridge Guardian - Cross-chain bridge with oracle verification.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - User initiates bridge via InitiateBridge
    /// - Contract requests verification → Gateway calls bridge oracle
    /// - Gateway fulfills → Contract verifies signature → Completes bridge
    ///
    /// MECHANICS:
    /// - Lock tokens on Neo N3
    /// - Oracle verifies cross-chain transaction
    /// - Release tokens on target chain (off-chain)
    /// </summary>
    [DisplayName("MiniAppBridgeGuardian")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Bridge Guardian - Cross-chain bridge with on-chain oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-bridgeguardian";
        private const long MIN_BRIDGE_AMOUNT = 100000000; // 1 GAS
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_BRIDGE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BRIDGES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_BRIDGE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Bridge Data Structure
        public struct BridgeData
        {
            public UInt160 User;
            public string TargetChain;
            public BigInteger Amount;
            public string TargetAddress;
            public BigInteger Timestamp;
            public bool Completed;
            public bool Success;
        }
        #endregion

        #region App Events
        [DisplayName("BridgeInitiated")]
        public static event BridgeInitiatedHandler OnBridgeInitiated;

        [DisplayName("VerificationRequested")]
        public static event VerificationRequestedHandler OnVerificationRequested;

        [DisplayName("BridgeCompleted")]
        public static event BridgeCompletedHandler OnBridgeCompleted;

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
            Storage.Put(Storage.CurrentContext, PREFIX_BRIDGE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Initiate a cross-chain bridge transfer.
        /// </summary>
        public static BigInteger InitiateBridge(UInt160 user, string targetChain, BigInteger amount, string targetAddress)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");
            ExecutionEngine.Assert(targetChain != null && targetChain.Length > 0, "target chain required");
            ExecutionEngine.Assert(amount >= MIN_BRIDGE_AMOUNT, "min bridge 1 GAS");
            ExecutionEngine.Assert(targetAddress != null && targetAddress.Length > 0, "target address required");

            BigInteger bridgeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BRIDGE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BRIDGE_ID, bridgeId);

            BridgeData bridge = new BridgeData
            {
                User = user,
                TargetChain = targetChain,
                Amount = amount,
                TargetAddress = targetAddress,
                Timestamp = Runtime.Time,
                Completed = false,
                Success = false
            };
            StoreBridge(bridgeId, bridge);

            // Request bridge verification from oracle
            BigInteger requestId = RequestBridgeVerification(bridgeId, targetChain, amount, targetAddress);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BRIDGE, (ByteString)requestId.ToByteArray()),
                bridgeId);

            OnBridgeInitiated(user, targetChain, amount, bridgeId);
            OnVerificationRequested(bridgeId, requestId);
            return bridgeId;
        }

        [Safe]
        public static BridgeData GetBridge(BigInteger bridgeId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_BRIDGES, (ByteString)bridgeId.ToByteArray()));
            if (data == null) return new BridgeData();
            return (BridgeData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestBridgeVerification(BigInteger bridgeId, string targetChain, BigInteger amount, string targetAddress)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { bridgeId, targetChain, amount, targetAddress });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "bridge-oracle", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString bridgeIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BRIDGE, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(bridgeIdData != null, "unknown request");

            BigInteger bridgeId = (BigInteger)bridgeIdData;
            BridgeData bridge = GetBridge(bridgeId);
            ExecutionEngine.Assert(!bridge.Completed, "already completed");
            ExecutionEngine.Assert(bridge.User != null, "bridge not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_BRIDGE, (ByteString)requestId.ToByteArray()));

            bridge.Completed = true;
            bridge.Success = success;
            StoreBridge(bridgeId, bridge);

            OnBridgeCompleted(bridge.User, bridge.TargetChain, bridge.Amount, success, bridgeId);
        }

        #endregion

        #region Internal Helpers

        private static void StoreBridge(BigInteger bridgeId, BridgeData bridge)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_BRIDGES, (ByteString)bridgeId.ToByteArray()),
                StdLib.Serialize(bridge));
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
        /// LOGIC: Verify pending cross-chain transactions.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated verification
            ProcessAutomatedVerification();
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
        /// Internal method to process automated verification.
        /// Called by OnPeriodicExecution.
        /// LOGIC: Iterate through pending bridge transactions and verify them.
        /// </summary>
        private static void ProcessAutomatedVerification()
        {
            // Get total bridges
            BigInteger bridgeCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BRIDGE_ID);
            if (bridgeCount == 0) return;

            // Process recent pending bridges (last 10 for gas efficiency)
            BigInteger startId = bridgeCount > 10 ? bridgeCount - 10 : 1;

            for (BigInteger i = startId; i <= bridgeCount; i++)
            {
                BridgeData bridge = GetBridge(i);
                if (bridge.User == null || bridge.Completed) continue;

                // Request verification for pending bridge
                BigInteger requestId = RequestBridgeVerification(i, bridge.TargetChain, bridge.Amount, bridge.TargetAddress);
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_REQUEST_TO_BRIDGE, (ByteString)requestId.ToByteArray()),
                    i);

                OnVerificationRequested(i, requestId);
            }
        }

        #endregion
    }
}
