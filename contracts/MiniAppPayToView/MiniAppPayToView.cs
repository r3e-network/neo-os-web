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
    public delegate void ContentCreatedHandler(BigInteger contentId, UInt160 creator, BigInteger price);
    public delegate void ContentPurchasedHandler(UInt160 buyer, BigInteger contentId, BigInteger price);
    public delegate void CreatorWithdrawnHandler(UInt160 creator, BigInteger amount);

    /// <summary>
    /// Pay-to-View MiniApp - Pay GAS to unlock premium content.
    /// Creators publish content, users pay to access.
    /// </summary>
    [DisplayName("MiniAppPayToView")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. PayToView is a content monetization application for premium access. Use it to publish or purchase exclusive content, you can earn from your creations or unlock premium materials.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-pay-to-view";
        private const int PLATFORM_FEE_PERCENT = 10;
        private const long MIN_PRICE = 1000000; // 0.01 GAS minimum
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_CONTENT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CONTENT = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_ACCESS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_CREATOR_BALANCE = new byte[] { 0x13 };
        #endregion

        #region Content Structure
        public struct Content
        {
            public UInt160 Creator;
            public BigInteger Price;
            public string ContentHash;
            public BigInteger PurchaseCount;
            public bool Active;
        }
        #endregion

        #region Events
        [DisplayName("ContentCreated")]
        public static event ContentCreatedHandler OnContentCreated;

        [DisplayName("ContentPurchased")]
        public static event ContentPurchasedHandler OnContentPurchased;

        [DisplayName("CreatorWithdrawn")]
        public static event CreatorWithdrawnHandler OnCreatorWithdrawn;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalContent() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CONTENT_ID);

        [Safe]
        public static Content GetContent(BigInteger contentId)
        {
            byte[] key = Helper.Concat(PREFIX_CONTENT, (ByteString)contentId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new Content();
            return (Content)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasAccess(UInt160 user, BigInteger contentId)
        {
            byte[] key = Helper.Concat(PREFIX_ACCESS, user);
            key = Helper.Concat(key, (ByteString)contentId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static BigInteger GetCreatorBalance(UInt160 creator)
        {
            byte[] key = Helper.Concat(PREFIX_CREATOR_BALANCE, creator);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CONTENT_ID, 0);
        }
        #endregion

        #region Creator Methods
        public static BigInteger CreateContent(UInt160 creator, BigInteger price, string contentHash)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ExecutionEngine.Assert(price >= MIN_PRICE, "price too low");
            ExecutionEngine.Assert(contentHash.Length > 0, "invalid hash");

            BigInteger contentId = TotalContent() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CONTENT_ID, contentId);

            Content content = new Content
            {
                Creator = creator,
                Price = price,
                ContentHash = contentHash,
                PurchaseCount = 0,
                Active = true
            };

            byte[] key = Helper.Concat(PREFIX_CONTENT, (ByteString)contentId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(content));

            // Creator has access to own content
            byte[] accessKey = Helper.Concat(PREFIX_ACCESS, creator);
            accessKey = Helper.Concat(accessKey, (ByteString)contentId.ToByteArray());
            Storage.Put(Storage.CurrentContext, accessKey, 1);

            OnContentCreated(contentId, creator, price);
            return contentId;
        }

        public static void WithdrawEarnings(UInt160 creator)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            byte[] balanceKey = Helper.Concat(PREFIX_CREATOR_BALANCE, creator);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, balanceKey);
            ExecutionEngine.Assert(balance > 0, "no balance");

            Storage.Put(Storage.CurrentContext, balanceKey, 0);

            // SECURITY FIX: Actually transfer GAS to creator
            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, creator, balance);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            OnCreatorWithdrawn(creator, balance);
        }
        #endregion

        #region User Methods
        public static void PurchaseAccess(UInt160 buyer, BigInteger contentId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            // Check not already purchased
            ExecutionEngine.Assert(!HasAccess(buyer, contentId), "already purchased");

            Content content = GetContent(contentId);
            ExecutionEngine.Assert(content.Active, "content not found");

            ValidatePaymentReceipt(APP_ID, buyer, content.Price, receiptId);

            // Grant access
            byte[] accessKey = Helper.Concat(PREFIX_ACCESS, buyer);
            accessKey = Helper.Concat(accessKey, (ByteString)contentId.ToByteArray());
            Storage.Put(Storage.CurrentContext, accessKey, 1);

            // Calculate creator earnings (90%)
            BigInteger creatorEarnings = content.Price * (100 - PLATFORM_FEE_PERCENT) / 100;

            // Update creator balance
            byte[] balanceKey = Helper.Concat(PREFIX_CREATOR_BALANCE, content.Creator);
            BigInteger currentBalance = (BigInteger)Storage.Get(Storage.CurrentContext, balanceKey);
            Storage.Put(Storage.CurrentContext, balanceKey, currentBalance + creatorEarnings);

            // Update purchase count
            content.PurchaseCount += 1;
            byte[] contentKey = Helper.Concat(PREFIX_CONTENT, (ByteString)contentId.ToByteArray());
            Storage.Put(Storage.CurrentContext, contentKey, StdLib.Serialize(content));

            OnContentPurchased(buyer, contentId, content.Price);
        }
        #endregion

        #region Admin Methods
        public static void DeactivateContent(BigInteger contentId)
        {
            ValidateAdmin();

            Content content = GetContent(contentId);
            ExecutionEngine.Assert(content.Active, "not active");

            content.Active = false;
            byte[] key = Helper.Concat(PREFIX_CONTENT, (ByteString)contentId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(content));
        }
        #endregion
    }
}
