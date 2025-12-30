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
    public delegate void SwitchCreatedHandler(BigInteger switchId, UInt160 owner, UInt160 heir, BigInteger checkInterval);
    public delegate void HeartbeatHandler(BigInteger switchId, BigInteger nextDeadline);
    public delegate void SwitchTriggeredHandler(BigInteger switchId, UInt160 heir, BigInteger amount);

    /// <summary>
    /// Dead Man's Switch - Automated inheritance with heartbeat detection.
    ///
    /// MECHANICS:
    /// - Deposit assets and set heir address
    /// - Must check in periodically (heartbeat)
    /// - If heartbeat missed, assets auto-transfer to heir
    /// - Optional: encrypted messages delivered via TEE
    /// </summary>
    [DisplayName("MiniAppDeadSwitch")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DeadSwitch is an automated inheritance system for digital assets. Use it to set up dead man's switches, you can ensure assets transfer to heirs if heartbeat stops.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dead-switch";
        private const long MIN_DEPOSIT = 100000000; // 1 GAS minimum
        private const int MIN_INTERVAL = 86400; // 1 day minimum
        private const int MAX_INTERVAL = 31536000; // 1 year maximum
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_SWITCH_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_SWITCH_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_SWITCH_HEIR = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_SWITCH_BALANCE = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_SWITCH_INTERVAL = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_SWITCH_DEADLINE = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_SWITCH_MESSAGE = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_SWITCH_ACTIVE = new byte[] { 0x17 };
        #endregion

        #region Events
        [DisplayName("SwitchCreated")]
        public static event SwitchCreatedHandler OnSwitchCreated;

        [DisplayName("Heartbeat")]
        public static event HeartbeatHandler OnHeartbeat;

        [DisplayName("SwitchTriggered")]
        public static event SwitchTriggeredHandler OnSwitchTriggered;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalSwitches() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SWITCH_ID);

        [Safe]
        public static BigInteger GetDeadline(BigInteger switchId)
        {
            byte[] key = Helper.Concat(PREFIX_SWITCH_DEADLINE, (ByteString)switchId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetBalance(BigInteger switchId)
        {
            byte[] key = Helper.Concat(PREFIX_SWITCH_BALANCE, (ByteString)switchId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsActive(BigInteger switchId)
        {
            byte[] key = Helper.Concat(PREFIX_SWITCH_ACTIVE, (ByteString)switchId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SWITCH_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Create a new dead man's switch.
        /// </summary>
        public static void CreateSwitch(UInt160 owner, UInt160 heir, BigInteger checkInterval, string encryptedMessage, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(heir.IsValid && heir != owner, "invalid heir");
            ExecutionEngine.Assert(checkInterval >= MIN_INTERVAL && checkInterval <= MAX_INTERVAL, "invalid interval");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, MIN_DEPOSIT, receiptId);

            BigInteger switchId = TotalSwitches() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SWITCH_ID, switchId);

            byte[] ownerKey = Helper.Concat(PREFIX_SWITCH_OWNER, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] heirKey = Helper.Concat(PREFIX_SWITCH_HEIR, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, heirKey, heir);

            byte[] balanceKey = Helper.Concat(PREFIX_SWITCH_BALANCE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, balanceKey, MIN_DEPOSIT);

            byte[] intervalKey = Helper.Concat(PREFIX_SWITCH_INTERVAL, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, intervalKey, checkInterval);

            BigInteger deadline = Runtime.Time + checkInterval;
            byte[] deadlineKey = Helper.Concat(PREFIX_SWITCH_DEADLINE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, deadlineKey, deadline);

            if (encryptedMessage.Length > 0)
            {
                byte[] msgKey = Helper.Concat(PREFIX_SWITCH_MESSAGE, (ByteString)switchId.ToByteArray());
                Storage.Put(Storage.CurrentContext, msgKey, encryptedMessage);
            }

            byte[] activeKey = Helper.Concat(PREFIX_SWITCH_ACTIVE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 1);

            OnSwitchCreated(switchId, owner, heir, checkInterval);
        }

        /// <summary>
        /// Send heartbeat to reset deadline.
        /// </summary>
        public static void Heartbeat(UInt160 owner, BigInteger switchId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(switchId), "switch not active");

            byte[] ownerKey = Helper.Concat(PREFIX_SWITCH_OWNER, (ByteString)switchId.ToByteArray());
            UInt160 switchOwner = (UInt160)Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(switchOwner == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            byte[] intervalKey = Helper.Concat(PREFIX_SWITCH_INTERVAL, (ByteString)switchId.ToByteArray());
            BigInteger interval = (BigInteger)Storage.Get(Storage.CurrentContext, intervalKey);

            BigInteger newDeadline = Runtime.Time + interval;
            byte[] deadlineKey = Helper.Concat(PREFIX_SWITCH_DEADLINE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, deadlineKey, newDeadline);

            OnHeartbeat(switchId, newDeadline);
        }

        /// <summary>
        /// Trigger switch (called by automation when deadline passed).
        /// </summary>
        public static void TriggerSwitch(BigInteger switchId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(switchId), "switch not active");

            BigInteger deadline = GetDeadline(switchId);
            ExecutionEngine.Assert(Runtime.Time >= deadline, "deadline not reached");

            byte[] heirKey = Helper.Concat(PREFIX_SWITCH_HEIR, (ByteString)switchId.ToByteArray());
            UInt160 heir = (UInt160)Storage.Get(Storage.CurrentContext, heirKey);

            BigInteger balance = GetBalance(switchId);

            // Deactivate switch
            byte[] activeKey = Helper.Concat(PREFIX_SWITCH_ACTIVE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, activeKey, 0);

            // Clear balance
            byte[] balanceKey = Helper.Concat(PREFIX_SWITCH_BALANCE, (ByteString)switchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, balanceKey, 0);

            // Transfer to heir
            if (balance > 0)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, heir, balance);
            }

            OnSwitchTriggered(switchId, heir, balance);
        }

        /// <summary>
        /// Add more funds to switch.
        /// </summary>
        public static void AddFunds(UInt160 owner, BigInteger switchId, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(IsActive(switchId), "switch not active");

            byte[] ownerKey = Helper.Concat(PREFIX_SWITCH_OWNER, (ByteString)switchId.ToByteArray());
            UInt160 switchOwner = (UInt160)Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(switchOwner == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, amount, receiptId);

            byte[] balanceKey = Helper.Concat(PREFIX_SWITCH_BALANCE, (ByteString)switchId.ToByteArray());
            BigInteger currentBalance = (BigInteger)Storage.Get(Storage.CurrentContext, balanceKey);
            Storage.Put(Storage.CurrentContext, balanceKey, currentBalance + amount);
        }

        #endregion
    }
}
