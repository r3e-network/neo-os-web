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
    /// <summary>
    /// Event delegates for red envelope lifecycle.
    /// </summary>
    public delegate void EnvelopeCreatedHandler(BigInteger envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount);
    public delegate void RngRequestedHandler(BigInteger envelopeId, BigInteger requestId);
    public delegate void EnvelopeClaimedHandler(BigInteger envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining);
    public delegate void EnvelopeCompletedHandler(BigInteger envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
    public delegate void EnvelopeRefundedHandler(BigInteger envelopeId, UInt160 creator, BigInteger refundAmount);

    /// <summary>
    /// RedEnvelope MiniApp - WeChat-style random GAS red packets with RNG oracle.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Creator creates envelope via CreateEnvelope
    /// - Contract requests RNG to pre-generate random amounts
    /// - Claimers call Claim → Contract assigns pre-computed amount
    ///
    /// MECHANICS:
    /// - Creator deposits GAS and specifies packet count (max 100)
    /// - RNG generates all packet amounts at creation
    /// - "Best luck" winner tracked (highest single claim)
    /// - Each address can only claim once per envelope
    /// </summary>
    [DisplayName("MiniAppRedEnvelope")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Red Envelope - Random GAS packets with on-chain RNG oracle")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-redenvelope";
        private const long MIN_AMOUNT = 10000000; // 0.1 GAS
        private const int MAX_PACKETS = 100;
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_ENVELOPE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ENVELOPES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_GRABBER = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_TO_ENVELOPE = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AMOUNTS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct EnvelopeData
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger PacketCount;
            public BigInteger ClaimedCount;
            public BigInteger RemainingAmount;
            public UInt160 BestLuckAddress;
            public BigInteger BestLuckAmount;
            public bool Ready;
            public BigInteger ExpiryTime;
        }
        #endregion

        #region App Events
        [DisplayName("EnvelopeCreated")]
        public static event EnvelopeCreatedHandler OnEnvelopeCreated;

        [DisplayName("RngRequested")]
        public static event RngRequestedHandler OnRngRequested;

        [DisplayName("EnvelopeClaimed")]
        public static event EnvelopeClaimedHandler OnEnvelopeClaimed;

        [DisplayName("EnvelopeCompleted")]
        public static event EnvelopeCompletedHandler OnEnvelopeCompleted;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;

        [DisplayName("EnvelopeRefunded")]
        public static event EnvelopeRefundedHandler OnEnvelopeRefunded;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ENVELOPE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Create a new red envelope with RNG-generated amounts.
        /// </summary>
        public static BigInteger CreateEnvelope(UInt160 creator, BigInteger totalAmount, BigInteger packetCount, BigInteger expiryDurationMs, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(totalAmount >= MIN_AMOUNT, "min amount 0.1 GAS");
            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "1-100 packets");
            ExecutionEngine.Assert(totalAmount >= packetCount * 1000000, "min 0.01 GAS per packet");
            ExecutionEngine.Assert(expiryDurationMs > 0, "expiry duration required");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, totalAmount, receiptId);

            BigInteger envelopeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ENVELOPE_ID, envelopeId);

            EnvelopeData envelope = new EnvelopeData
            {
                Creator = creator,
                TotalAmount = totalAmount,
                PacketCount = packetCount,
                ClaimedCount = 0,
                RemainingAmount = totalAmount,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                Ready = false,
                ExpiryTime = Runtime.Time + expiryDurationMs
            };
            StoreEnvelope(envelopeId, envelope);

            // Request RNG to generate packet amounts
            BigInteger requestId = RequestRng(envelopeId, packetCount);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_ENVELOPE, (ByteString)requestId.ToByteArray()),
                envelopeId);

            OnEnvelopeCreated(envelopeId, creator, totalAmount, packetCount);
            OnRngRequested(envelopeId, requestId);
            return envelopeId;
        }

        /// <summary>
        /// Claim a packet from an envelope.
        /// </summary>
        public static BigInteger Claim(BigInteger envelopeId, UInt160 claimer)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            EnvelopeData envelope = GetEnvelope(envelopeId);
            ExecutionEngine.Assert(envelope.Creator != null, "envelope not found");
            ExecutionEngine.Assert(envelope.Ready, "envelope not ready");
            ExecutionEngine.Assert(envelope.ClaimedCount < envelope.PacketCount, "envelope empty");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)envelope.ExpiryTime, "envelope expired");

            // Check if already claimed
            ByteString grabberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_GRABBER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])claimer);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, grabberKey) == null, "already claimed");

            // Get pre-computed amount for this claim index
            BigInteger claimIndex = envelope.ClaimedCount + 1;
            BigInteger amount = GetPacketAmount(envelopeId, claimIndex);

            // Mark as claimed
            Storage.Put(Storage.CurrentContext, grabberKey, amount);

            // Update envelope
            envelope.ClaimedCount = claimIndex;
            envelope.RemainingAmount = envelope.RemainingAmount - amount;

            if (amount > envelope.BestLuckAmount)
            {
                envelope.BestLuckAddress = claimer;
                envelope.BestLuckAmount = amount;
            }

            StoreEnvelope(envelopeId, envelope);

            BigInteger remaining = envelope.PacketCount - envelope.ClaimedCount;
            OnEnvelopeClaimed(envelopeId, claimer, amount, remaining);

            if (remaining == 0)
            {
                OnEnvelopeCompleted(envelopeId, envelope.BestLuckAddress, envelope.BestLuckAmount);
            }

            return amount;
        }

        [Safe]
        public static EnvelopeData GetEnvelope(BigInteger envelopeId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ENVELOPES, (ByteString)envelopeId.ToByteArray()));
            if (data == null) return new EnvelopeData();
            return (EnvelopeData)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasClaimed(BigInteger envelopeId, UInt160 claimer)
        {
            ByteString grabberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_GRABBER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])claimer);
            return Storage.Get(Storage.CurrentContext, grabberKey) != null;
        }

        [Safe]
        public static BigInteger GetPacketAmount(BigInteger envelopeId, BigInteger index)
        {
            ByteString amountKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_AMOUNTS, (ByteString)envelopeId.ToByteArray()),
                (ByteString)index.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, amountKey);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestRng(BigInteger envelopeId, BigInteger packetCount)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { envelopeId, packetCount });
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

            ByteString envelopeIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ENVELOPE, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(envelopeIdData != null, "unknown request");

            BigInteger envelopeId = (BigInteger)envelopeIdData;
            EnvelopeData envelope = GetEnvelope(envelopeId);
            ExecutionEngine.Assert(!envelope.Ready, "already ready");
            ExecutionEngine.Assert(envelope.Creator != null, "envelope not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_ENVELOPE, (ByteString)requestId.ToByteArray()));

            if (success && result != null && result.Length > 0)
            {
                // Result format: array of amounts for each packet
                object[] amounts = (object[])StdLib.Deserialize(result);

                // Store pre-computed amounts
                for (BigInteger i = 1; i <= envelope.PacketCount; i++)
                {
                    BigInteger amount = (BigInteger)amounts[(int)(i - 1)];
                    ByteString amountKey = Helper.Concat(
                        Helper.Concat((ByteString)PREFIX_AMOUNTS, (ByteString)envelopeId.ToByteArray()),
                        (ByteString)i.ToByteArray());
                    Storage.Put(Storage.CurrentContext, amountKey, amount);
                }

                envelope.Ready = true;
                StoreEnvelope(envelopeId, envelope);
            }
        }

        #endregion

        #region Internal Helpers

        private static void StoreEnvelope(BigInteger envelopeId, EnvelopeData envelope)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ENVELOPES, (ByteString)envelopeId.ToByteArray()),
                StdLib.Serialize(envelope));
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
        /// LOGIC: Scans for expired envelopes and refunds remaining balance to creators.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated refunds for expired envelopes
            ProcessAutomatedRefund();
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
        /// Internal method to process automated refunds for expired envelopes.
        /// Called by OnPeriodicExecution.
        /// </summary>
        private static void ProcessAutomatedRefund()
        {
            // In production, this would iterate through active envelopes
            // For this implementation, we process envelope IDs 1-10 as examples
            // A more sophisticated approach would maintain an active envelope index

            BigInteger currentEnvelopeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID);
            BigInteger startId = currentEnvelopeId > 10 ? currentEnvelopeId - 10 : 1;

            for (BigInteger envelopeId = startId; envelopeId <= currentEnvelopeId; envelopeId++)
            {
                EnvelopeData envelope = GetEnvelope(envelopeId);

                // Skip if envelope doesn't exist, not ready, or not expired
                if (envelope.Creator == null || !envelope.Ready)
                {
                    continue;
                }

                // Check if envelope is expired and has unclaimed packets
                if (Runtime.Time > (ulong)envelope.ExpiryTime && envelope.RemainingAmount > 0)
                {
                    // Refund remaining amount to creator
                    BigInteger refundAmount = envelope.RemainingAmount;
                    envelope.RemainingAmount = 0;
                    StoreEnvelope(envelopeId, envelope);

                    OnEnvelopeRefunded(envelopeId, envelope.Creator, refundAmount);
                }
            }
        }

        #endregion
    }
}
