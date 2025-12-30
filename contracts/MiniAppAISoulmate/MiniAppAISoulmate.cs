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
    public delegate void SoulmateCreatedHandler(BigInteger soulmateId, UInt160 owner, string personality);
    public delegate void MemoryStoredHandler(BigInteger soulmateId, string memoryHash);
    public delegate void PersonalityEvolvedHandler(BigInteger soulmateId, string oldTrait, string newTrait);
    public delegate void SoulmateTransferredHandler(BigInteger soulmateId, UInt160 from, UInt160 to, bool keepMemory);

    /// <summary>
    /// AI Soulmate - Private AI companion with TEE-encrypted memories.
    ///
    /// MECHANICS:
    /// - Create AI companion NFT with personality traits
    /// - Chat history stored encrypted in TEE (only AI can read)
    /// - Personality evolves based on interactions
    /// - Transfer with or without memories (owner choice)
    /// </summary>
    [DisplayName("MiniAppAISoulmate")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. AISoulmate is an AI companion application for personalized interactions. Use it to create and chat with AI companions, you can build evolving relationships with TEE-encrypted memories.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-ai-soulmate";
        private const long CREATE_FEE = 100000000; // 1 GAS
        private const long CHAT_FEE = 1000000; // 0.01 GAS per message
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_SOULMATE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_SOULMATE_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_SOULMATE_PERSONALITY = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_SOULMATE_MEMORY_HASH = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_SOULMATE_CHAT_COUNT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_SOULMATE_CREATED = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REQUEST_TO_SOULMATE = new byte[] { 0x16 };
        #endregion

        #region Events
        [DisplayName("SoulmateCreated")]
        public static event SoulmateCreatedHandler OnSoulmateCreated;

        [DisplayName("MemoryStored")]
        public static event MemoryStoredHandler OnMemoryStored;

        [DisplayName("PersonalityEvolved")]
        public static event PersonalityEvolvedHandler OnPersonalityEvolved;

        [DisplayName("SoulmateTransferred")]
        public static event SoulmateTransferredHandler OnSoulmateTransferred;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalSoulmates() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SOULMATE_ID);

        [Safe]
        public static UInt160 GetOwner(BigInteger soulmateId)
        {
            byte[] key = Helper.Concat(PREFIX_SOULMATE_OWNER, (ByteString)soulmateId.ToByteArray());
            return (UInt160)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static string GetPersonality(BigInteger soulmateId)
        {
            byte[] key = Helper.Concat(PREFIX_SOULMATE_PERSONALITY, (ByteString)soulmateId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetChatCount(BigInteger soulmateId)
        {
            byte[] key = Helper.Concat(PREFIX_SOULMATE_CHAT_COUNT, (ByteString)soulmateId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SOULMATE_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Create a new AI soulmate.
        /// </summary>
        public static void CreateSoulmate(UInt160 owner, string personality, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(personality.Length > 0 && personality.Length <= 64, "invalid personality");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, CREATE_FEE, receiptId);

            BigInteger soulmateId = TotalSoulmates() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SOULMATE_ID, soulmateId);

            byte[] ownerKey = Helper.Concat(PREFIX_SOULMATE_OWNER, (ByteString)soulmateId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] personalityKey = Helper.Concat(PREFIX_SOULMATE_PERSONALITY, (ByteString)soulmateId.ToByteArray());
            Storage.Put(Storage.CurrentContext, personalityKey, personality);

            byte[] createdKey = Helper.Concat(PREFIX_SOULMATE_CREATED, (ByteString)soulmateId.ToByteArray());
            Storage.Put(Storage.CurrentContext, createdKey, Runtime.Time);

            OnSoulmateCreated(soulmateId, owner, personality);
        }

        /// <summary>
        /// Chat with soulmate (triggers TEE processing).
        /// </summary>
        public static void Chat(UInt160 owner, BigInteger soulmateId, string messageHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 soulmateOwner = GetOwner(soulmateId);
            ExecutionEngine.Assert(soulmateOwner == owner, "not owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, CHAT_FEE, receiptId);

            // Increment chat count
            byte[] countKey = Helper.Concat(PREFIX_SOULMATE_CHAT_COUNT, (ByteString)soulmateId.ToByteArray());
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Request TEE to process chat and potentially evolve personality
            RequestChatProcess(soulmateId, messageHash);
        }

        /// <summary>
        /// Transfer soulmate to new owner.
        /// </summary>
        public static void Transfer(UInt160 from, UInt160 to, BigInteger soulmateId, bool keepMemory, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 currentOwner = GetOwner(soulmateId);
            ExecutionEngine.Assert(currentOwner == from, "not owner");
            ExecutionEngine.Assert(to.IsValid, "invalid recipient");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(from), "unauthorized");

            byte[] ownerKey = Helper.Concat(PREFIX_SOULMATE_OWNER, (ByteString)soulmateId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, to);

            if (!keepMemory)
            {
                // Clear memory hash (TEE will wipe encrypted data)
                byte[] memoryKey = Helper.Concat(PREFIX_SOULMATE_MEMORY_HASH, (ByteString)soulmateId.ToByteArray());
                Storage.Delete(Storage.CurrentContext, memoryKey);
            }

            OnSoulmateTransferred(soulmateId, from, to, keepMemory);
        }

        #endregion

        #region Service Callbacks

        private static void RequestChatProcess(BigInteger soulmateId, string messageHash)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { soulmateId, messageHash });
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "compute", payload,
                Runtime.ExecutingScriptHash, "onChatCallback"
            );

            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_SOULMATE, (ByteString)requestId.ToByteArray()),
                soulmateId);
        }

        public static void OnChatCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString soulmateIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_SOULMATE, (ByteString)requestId.ToByteArray()));
            if (soulmateIdData == null) return;

            BigInteger soulmateId = (BigInteger)soulmateIdData;

            if (success && result != null)
            {
                object[] chatResult = (object[])StdLib.Deserialize(result);
                string newMemoryHash = (string)chatResult[0];
                string personalityChange = (string)chatResult[1];

                // Update memory hash
                byte[] memoryKey = Helper.Concat(PREFIX_SOULMATE_MEMORY_HASH, (ByteString)soulmateId.ToByteArray());
                Storage.Put(Storage.CurrentContext, memoryKey, newMemoryHash);
                OnMemoryStored(soulmateId, newMemoryHash);

                // Check for personality evolution
                if (personalityChange.Length > 0)
                {
                    string oldPersonality = GetPersonality(soulmateId);
                    byte[] personalityKey = Helper.Concat(PREFIX_SOULMATE_PERSONALITY, (ByteString)soulmateId.ToByteArray());
                    Storage.Put(Storage.CurrentContext, personalityKey, personalityChange);
                    OnPersonalityEvolved(soulmateId, oldPersonality, personalityChange);
                }
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_SOULMATE, (ByteString)requestId.ToByteArray()));
        }

        #endregion
    }
}
