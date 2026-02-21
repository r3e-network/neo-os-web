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
    public delegate void WhisperSentHandler(BigInteger whisperId, ByteString contentHash);
    public delegate void WhisperReceivedHandler(BigInteger whisperId, UInt160 receiver);
    public delegate void WhisperExpiredHandler(BigInteger whisperId);

    /// <summary>
    /// WhisperChain MiniApp - Voice message drift bottles on blockchain.
    /// Send encrypted voice messages that randomly find recipients.
    /// </summary>
    [DisplayName("MiniAppWhisperChain")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. WhisperChain is an anonymous messaging system for voice drift bottles. Use it to send encrypted voice messages, you can randomly connect with others through blockchain-based message discovery.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-whisperchain";
        private const long SEND_FEE = 5000000; // 0.05 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_WHISPER_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_WHISPERS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_FLOATING = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct WhisperData
        {
            public UInt160 Sender;
            public ByteString ContentHash;
            public BigInteger CreateTime;
            public BigInteger ExpiryTime;
            public UInt160 Receiver;
            public bool Claimed;
        }
        #endregion

        #region App Events
        [DisplayName("WhisperSent")]
        public static event WhisperSentHandler OnWhisperSent;

        [DisplayName("WhisperReceived")]
        public static event WhisperReceivedHandler OnWhisperReceived;

        [DisplayName("WhisperExpired")]
        public static event WhisperExpiredHandler OnWhisperExpired;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_WHISPER_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger SendWhisper(UInt160 sender, ByteString contentHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length == 32, "invalid hash");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(sender), "unauthorized");

            ValidatePaymentReceipt(APP_ID, sender, SEND_FEE, receiptId);

            BigInteger whisperId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_WHISPER_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_WHISPER_ID, whisperId);

            WhisperData whisper = new WhisperData
            {
                Sender = sender,
                ContentHash = contentHash,
                CreateTime = Runtime.Time,
                ExpiryTime = Runtime.Time + 86400000 * 7,
                Receiver = UInt160.Zero,
                Claimed = false
            };
            StoreWhisper(whisperId, whisper);

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_FLOATING, (ByteString)whisperId.ToByteArray()), 1);

            OnWhisperSent(whisperId, contentHash);
            return whisperId;
        }

        public static BigInteger ClaimWhisper(UInt160 receiver)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(receiver), "unauthorized");

            BigInteger maxId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_WHISPER_ID);
            BigInteger seed = Runtime.Time;

            for (int i = 0; i < 20; i++)
            {
                BigInteger candidateId = (seed + i) % maxId + 1;
                ByteString floating = Storage.Get(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_FLOATING, (ByteString)candidateId.ToByteArray()));

                if (floating != null)
                {
                    WhisperData whisper = GetWhisper(candidateId);
                    if (!whisper.Claimed && whisper.Sender != receiver)
                    {
                        whisper.Receiver = receiver;
                        whisper.Claimed = true;
                        StoreWhisper(candidateId, whisper);

                        Storage.Delete(Storage.CurrentContext,
                            Helper.Concat((ByteString)PREFIX_FLOATING, (ByteString)candidateId.ToByteArray()));

                        OnWhisperReceived(candidateId, receiver);
                        return candidateId;
                    }
                }
            }
            return 0;
        }

        [Safe]
        public static WhisperData GetWhisper(BigInteger whisperId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_WHISPERS, (ByteString)whisperId.ToByteArray()));
            if (data == null) return new WhisperData();
            return (WhisperData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreWhisper(BigInteger whisperId, WhisperData whisper)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_WHISPERS, (ByteString)whisperId.ToByteArray()),
                StdLib.Serialize(whisper));
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
