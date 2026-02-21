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
    public delegate void BroadcastHandler(BigInteger msgId, string contentHash, BigInteger gasSpent, BigInteger expiresAt);

    /// <summary>
    /// Dark Forest Radio - Anonymous censorship-resistant broadcast.
    ///
    /// MECHANICS:
    /// - Pay GAS to broadcast anonymous messages
    /// - More GAS = longer display time, bigger font
    /// - TEE strips sender identity before broadcast
    /// </summary>
    [DisplayName("MiniAppDarkRadio")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DarkRadio is an anonymous broadcast platform for private messaging. Use it to broadcast censorship-resistant messages, you can share thoughts anonymously with display time proportional to GAS spent.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dark-radio";
        private const long MIN_BROADCAST = 10000000; // 0.1 GAS
        private const int SECONDS_PER_GAS = 3600; // 1 hour per GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_MSG_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MSG_HASH = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MSG_EXPIRES = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_MSG_PRIORITY = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TOTAL_BURNED = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("Broadcast")]
        public static event BroadcastHandler OnBroadcast;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalMessages() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MSG_ID);

        [Safe]
        public static BigInteger TotalBurned() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BURNED);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MSG_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, 0);
        }
        #endregion

        #region User Methods

        public static void Broadcast(UInt160 sender, string contentHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0 && contentHash.Length <= 128, "invalid content");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(sender), "unauthorized");

            ValidatePaymentReceipt(APP_ID, sender, MIN_BROADCAST, receiptId);

            BigInteger msgId = TotalMessages() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MSG_ID, msgId);

            byte[] hashKey = Helper.Concat(PREFIX_MSG_HASH, (ByteString)msgId.ToByteArray());
            Storage.Put(Storage.CurrentContext, hashKey, contentHash);

            // Calculate display duration based on payment
            BigInteger duration = (MIN_BROADCAST / 100000000) * SECONDS_PER_GAS;
            BigInteger expiresAt = Runtime.Time + duration;

            byte[] expiresKey = Helper.Concat(PREFIX_MSG_EXPIRES, (ByteString)msgId.ToByteArray());
            Storage.Put(Storage.CurrentContext, expiresKey, expiresAt);

            // Update total burned
            BigInteger totalBurned = TotalBurned();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, totalBurned + MIN_BROADCAST);

            OnBroadcast(msgId, contentHash, MIN_BROADCAST, expiresAt);
        }

        public static void BroadcastPremium(UInt160 sender, string contentHash, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0 && contentHash.Length <= 128, "invalid content");
            ExecutionEngine.Assert(amount >= MIN_BROADCAST, "amount too low");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(sender), "unauthorized");

            ValidatePaymentReceipt(APP_ID, sender, amount, receiptId);

            BigInteger msgId = TotalMessages() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MSG_ID, msgId);

            byte[] hashKey = Helper.Concat(PREFIX_MSG_HASH, (ByteString)msgId.ToByteArray());
            Storage.Put(Storage.CurrentContext, hashKey, contentHash);

            BigInteger duration = (amount / 100000000) * SECONDS_PER_GAS;
            BigInteger expiresAt = Runtime.Time + duration;

            byte[] expiresKey = Helper.Concat(PREFIX_MSG_EXPIRES, (ByteString)msgId.ToByteArray());
            Storage.Put(Storage.CurrentContext, expiresKey, expiresAt);

            byte[] priorityKey = Helper.Concat(PREFIX_MSG_PRIORITY, (ByteString)msgId.ToByteArray());
            Storage.Put(Storage.CurrentContext, priorityKey, amount);

            BigInteger totalBurned = TotalBurned();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, totalBurned + amount);

            OnBroadcast(msgId, contentHash, amount, expiresAt);
        }

        #endregion
    }
}
