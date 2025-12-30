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
    public delegate void CapsuleBuriedHandler(UInt160 owner, BigInteger capsuleId, BigInteger unlockTime, bool isPublic);
    public delegate void CapsuleRevealedHandler(BigInteger capsuleId, UInt160 revealer);
    public delegate void CapsuleFishedHandler(UInt160 fisher, BigInteger capsuleId);
    public delegate void CapsuleEncryptedHandler(BigInteger capsuleId, ByteString encryptedContent);
    public delegate void CapsuleDecryptedHandler(BigInteger capsuleId, ByteString decryptedContent);

    /// <summary>
    /// TEE Time Capsule - Encrypted messages unlocked by time or conditions.
    ///
    /// GAME MECHANICS:
    /// - Users bury encrypted messages with unlock conditions
    /// - Content encrypted by TEE, no one can read until unlock
    /// - Conditions: time-based or price-based triggers
    /// - Public capsules can be "fished" by others
    /// </summary>
    [DisplayName("MiniAppTimeCapsule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. TimeCapsule is a time-locked message system for future delivery. Use it to bury encrypted messages, you can reveal content after time conditions are met.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-time-capsule";
        private const long BURY_FEE = 20000000; // 0.2 GAS
        private const long FISH_FEE = 5000000; // 0.05 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_CAPSULE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CAPSULE_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_CAPSULE_HASH = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_CAPSULE_UNLOCK = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_CAPSULE_PUBLIC = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_CAPSULE_REVEALED = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_PUBLIC_CAPSULES = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_CAPSULE_ENCRYPTED = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_REQUEST_TO_CAPSULE = new byte[] { 0x18 };
        #endregion

        #region Events
        [DisplayName("CapsuleBuried")]
        public static event CapsuleBuriedHandler OnCapsuleBuried;

        [DisplayName("CapsuleRevealed")]
        public static event CapsuleRevealedHandler OnCapsuleRevealed;

        [DisplayName("CapsuleFished")]
        public static event CapsuleFishedHandler OnCapsuleFished;

        [DisplayName("CapsuleEncrypted")]
        public static event CapsuleEncryptedHandler OnCapsuleEncrypted;

        [DisplayName("CapsuleDecrypted")]
        public static event CapsuleDecryptedHandler OnCapsuleDecrypted;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalCapsules() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CAPSULE_ID);

        [Safe]
        public static BigInteger UnlockTime(BigInteger capsuleId)
        {
            byte[] key = Helper.Concat(PREFIX_CAPSULE_UNLOCK, (ByteString)capsuleId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsRevealed(BigInteger capsuleId)
        {
            byte[] key = Helper.Concat(PREFIX_CAPSULE_REVEALED, (ByteString)capsuleId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Bury a new time capsule.
        /// </summary>
        public static void Bury(UInt160 owner, string contentHash, BigInteger unlockTime, bool isPublic, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(unlockTime > Runtime.Time, "unlock must be future");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, BURY_FEE, receiptId);

            BigInteger capsuleId = TotalCapsules() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, capsuleId);

            byte[] ownerKey = Helper.Concat(PREFIX_CAPSULE_OWNER, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] hashKey = Helper.Concat(PREFIX_CAPSULE_HASH, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, hashKey, contentHash);

            byte[] unlockKey = Helper.Concat(PREFIX_CAPSULE_UNLOCK, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, unlockKey, unlockTime);

            byte[] publicKey = Helper.Concat(PREFIX_CAPSULE_PUBLIC, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, publicKey, isPublic ? 1 : 0);

            OnCapsuleBuried(owner, capsuleId, unlockTime, isPublic);
        }

        /// <summary>
        /// Reveal capsule content (only after unlock time).
        /// </summary>
        public static void Reveal(UInt160 revealer, BigInteger capsuleId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(!IsRevealed(capsuleId), "already revealed");

            BigInteger unlock = UnlockTime(capsuleId);
            ExecutionEngine.Assert(Runtime.Time >= unlock, "not yet unlocked");

            byte[] ownerKey = Helper.Concat(PREFIX_CAPSULE_OWNER, (ByteString)capsuleId.ToByteArray());
            UInt160 owner = (UInt160)Storage.Get(Storage.CurrentContext, ownerKey);

            byte[] publicKey = Helper.Concat(PREFIX_CAPSULE_PUBLIC, (ByteString)capsuleId.ToByteArray());
            bool isPublic = (BigInteger)Storage.Get(Storage.CurrentContext, publicKey) == 1;

            ExecutionEngine.Assert(revealer == owner || isPublic, "not authorized");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(revealer), "unauthorized");

            byte[] revealedKey = Helper.Concat(PREFIX_CAPSULE_REVEALED, (ByteString)capsuleId.ToByteArray());
            Storage.Put(Storage.CurrentContext, revealedKey, 1);

            OnCapsuleRevealed(capsuleId, revealer);
        }

        /// <summary>
        /// Fish for a random public capsule.
        /// </summary>
        public static void Fish(UInt160 fisher, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(fisher), "unauthorized");

            ValidatePaymentReceipt(APP_ID, fisher, FISH_FEE, receiptId);

            // Find a random public unrevealed capsule
            BigInteger total = TotalCapsules();
            BigInteger capsuleId = (Runtime.Time % total) + 1;

            byte[] publicKey = Helper.Concat(PREFIX_CAPSULE_PUBLIC, (ByteString)capsuleId.ToByteArray());
            bool isPublic = (BigInteger)Storage.Get(Storage.CurrentContext, publicKey) == 1;

            if (isPublic && !IsRevealed(capsuleId))
            {
                OnCapsuleFished(fisher, capsuleId);
            }
        }

        /// <summary>
        /// SECURITY FIX: Allow admin to withdraw collected fees.
        /// </summary>
        public static void WithdrawFees(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(recipient);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw failed");
        }

        #endregion

        #region TEE Service Methods

        /// <summary>
        /// Request TEE to encrypt capsule content.
        /// </summary>
        private static BigInteger RequestTeeEncrypt(BigInteger capsuleId, ByteString content)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { "encrypt", capsuleId, content });
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "tee-compute", payload,
                Runtime.ExecutingScriptHash, "OnTeeCallback"
            );

            // Map request to capsule
            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_CAPSULE, (ByteString)requestId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, capsuleId);

            return requestId;
        }

        /// <summary>
        /// TEE service callback handler.
        /// </summary>
        public static void OnTeeCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            byte[] key = Helper.Concat(PREFIX_REQUEST_TO_CAPSULE, (ByteString)requestId.ToByteArray());
            ByteString capsuleIdData = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(capsuleIdData != null, "unknown request");

            BigInteger capsuleId = (BigInteger)capsuleIdData;
            Storage.Delete(Storage.CurrentContext, key);

            if (success && result != null && result.Length > 0)
            {
                // Store encrypted content
                byte[] encKey = Helper.Concat(PREFIX_CAPSULE_ENCRYPTED, (ByteString)capsuleId.ToByteArray());
                Storage.Put(Storage.CurrentContext, encKey, result);
                OnCapsuleEncrypted(capsuleId, result);
            }
        }

        #endregion
    }
}
