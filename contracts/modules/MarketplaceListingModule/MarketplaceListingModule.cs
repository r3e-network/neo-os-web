using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Modules
{
    /// <summary>
    /// Universal P2P marketplace module for listing and trading items.
    ///
    /// MULTI-TENANCY:
    /// All listings are namespaced by instance ID. A single deployed contract
    /// serves every miniapp instance that needs marketplace mechanics.
    ///
    /// FEATURES:
    /// - Create listings with seller, asset descriptor, and price
    /// - Cancel listings (seller or instance controller)
    /// - Purchase listings (buyer pays price, listing marked as sold)
    /// - Active listing index per instance
    /// - Seller listing index for querying by seller
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or registry caller): manage listings, facilitate purchases
    /// - Sellers: create and cancel their own listings
    /// - Buyers: purchase active listings
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       listing info (per instance + listingId)
    /// - 0x21       active listing count (per instance)
    /// - 0x22       seller listing count (per instance + seller)
    /// - 0x30       instance next listing id counter
    /// - 0x31       instance total listings created
    /// - 0x32       instance total purchases
    /// </summary>
    [DisplayName("MarketplaceListingModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped P2P marketplace module for listing and trading items")]
    [ContractPermission("*", "*")]
    public class MarketplaceListingModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_LISTING_INFO = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_ACTIVE_COUNT = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_SELLER_COUNT = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_INST_NEXT_LISTING_ID = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_INST_TOTAL_LISTINGS = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_INST_TOTAL_PURCHASES = new byte[] { 0x32 };

        #endregion

        #region Constants

        /// <summary>Listing status: active and available for purchase.</summary>
        public const byte STATUS_ACTIVE = 0;

        /// <summary>Listing status: cancelled by seller or controller.</summary>
        public const byte STATUS_CANCELLED = 1;

        /// <summary>Listing status: purchased by a buyer.</summary>
        public const byte STATUS_SOLD = 2;

        #endregion

        #region Data Structures

        public struct InstanceConfig
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct ListingInfo
        {
            public BigInteger ListingId;
            public UInt160 Seller;
            /// <summary>Asset descriptor (JSON or opaque string identifying the item being sold).</summary>
            public string Asset;
            /// <summary>Price in the smallest unit (e.g., GAS fractions).</summary>
            public BigInteger Price;
            public byte Status;
            public UInt160 Buyer;
            public BigInteger CreatedAt;
            public BigInteger CompletedAt;
        }

        #endregion

        #region Events

        [DisplayName("ListingCreated")]
        public static event Action<string, BigInteger, UInt160, string, BigInteger> OnListingCreated = delegate { };

        [DisplayName("ListingCancelled")]
        public static event Action<string, BigInteger, UInt160> OnListingCancelled = delegate { };

        [DisplayName("ListingPurchased")]
        public static event Action<string, BigInteger, UInt160, UInt160, BigInteger> OnListingPurchased = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Internal Helpers

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static void ValidateAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin);
        }

        private static bool IsRegistryCaller()
        {
            UInt160 registry = InstanceRegistry();
            return registry != UInt160.Zero && registry.IsValid && Runtime.CallingScriptHash == registry;
        }

        private static bool IsOperatorCaller(InstanceConfig config)
        {
            UInt160 op = config.Operator;
            return op != UInt160.Zero && op.IsValid && Runtime.CallingScriptHash == op;
        }

        private static bool IsInstanceController(InstanceConfig config)
        {
            return IsAdminWitness() ||
                   IsRegistryCaller() ||
                   (config.Owner != UInt160.Zero && Runtime.CheckWitness(config.Owner)) ||
                   IsOperatorCaller(config);
        }

        private static bool IsUserAuthorized(UInt160 user)
        {
            return user != UInt160.Zero && user.IsValid && Runtime.CheckWitness(user);
        }

        private static void RequireActiveInstance(InstanceConfig config)
        {
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(config.Active, "instance inactive");
        }

        private static InstanceConfig EmptyConfig()
        {
            return new InstanceConfig
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                Active = false,
                UpdatedAt = 0
            };
        }

        private static byte[] ConfigKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE_CONFIG, (ByteString)(instanceId ?? ""));
        }

        private static byte[] ListingKey(string instanceId, BigInteger listingId)
        {
            return Helper.Concat(PREFIX_LISTING_INFO,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)listingId));
        }

        private static byte[] ScopedInstanceKey(byte[] prefix, string instanceId)
        {
            return Helper.Concat(prefix, (ByteString)(instanceId ?? ""));
        }

        private static byte[] SellerCountKey(string instanceId, UInt160 seller)
        {
            return Helper.Concat(PREFIX_SELLER_COUNT,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])seller));
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, value);
            }
        }

        private static void IncrementCounter(byte[] key)
        {
            BigInteger current = ReadBigInteger(key);
            Storage.Put(Storage.CurrentContext, key, current + 1);
        }

        #endregion

        #region Safe Queries

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 InstanceRegistry()
        {
            return ReadAddress(PREFIX_INSTANCE_REGISTRY);
        }

        [Safe]
        public static InstanceConfig GetInstanceConfig(string instanceId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, ConfigKey(instanceId));
            return raw == null ? EmptyConfig() : (InstanceConfig)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get listing information by ID.
        /// </summary>
        [Safe]
        public static ListingInfo GetListing(string instanceId, BigInteger listingId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(listingId > 0, "invalid listing id");

            ByteString? raw = Storage.Get(Storage.CurrentContext, ListingKey(instanceId, listingId));
            if (raw == null)
            {
                return new ListingInfo
                {
                    ListingId = 0,
                    Seller = UInt160.Zero,
                    Asset = "",
                    Price = 0,
                    Status = STATUS_ACTIVE,
                    Buyer = UInt160.Zero,
                    CreatedAt = 0,
                    CompletedAt = 0
                };
            }
            return (ListingInfo)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the number of currently active listings for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetActiveListings(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_ACTIVE_COUNT, instanceId));
        }

        /// <summary>
        /// Get the number of listings created by a specific seller.
        /// </summary>
        [Safe]
        public static BigInteger GetSellerListings(string instanceId, UInt160 seller)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(seller, "seller");
            return ReadBigInteger(SellerCountKey(instanceId, seller));
        }

        /// <summary>
        /// Get the total number of listings ever created for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalListings(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_LISTINGS, instanceId));
        }

        /// <summary>
        /// Get the total number of purchases completed for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalPurchases(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_PURCHASES, instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a marketplace instance.
        /// </summary>
        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");

            InstanceConfig existing = GetInstanceConfig(instanceId);
            bool canInitialize = IsAdminWitness() || IsRegistryCaller();
            if (!canInitialize && existing.InstanceId.Length > 0)
            {
                canInitialize = IsInstanceController(existing);
            }
            ExecutionEngine.Assert(canInitialize, "unauthorized");

            InstanceConfig config = new InstanceConfig
            {
                InstanceId = instanceId,
                Owner = owner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceInitialized(instanceId, owner);
        }

        /// <summary>
        /// Activate or deactivate an instance.
        /// </summary>
        public static void SetInstanceActive(string instanceId, bool active)
        {
            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            config.Active = active;
            config.UpdatedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceStatusChanged(instanceId, active);
        }

        #endregion

        #region Listing Operations

        /// <summary>
        /// Create a new listing. The seller must sign the transaction or the instance
        /// controller may create on behalf of a seller.
        /// Returns the newly assigned listing ID.
        /// </summary>
        public static BigInteger CreateListing(string instanceId, UInt160 seller, string asset, BigInteger price)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(seller, "seller");
            ExecutionEngine.Assert(asset != null && asset.Length > 0, "asset required");
            ExecutionEngine.Assert(asset.Length <= 2048, "asset descriptor too long");
            ExecutionEngine.Assert(price > 0, "price must be > 0");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);

            // Authorization: seller signs or instance controller acts on their behalf
            bool authorized = IsUserAuthorized(seller) || IsInstanceController(config);
            ExecutionEngine.Assert(authorized, "unauthorized");

            // Allocate next listing ID
            byte[] nextIdKey = ScopedInstanceKey(PREFIX_INST_NEXT_LISTING_ID, instanceId);
            BigInteger listingId = ReadBigInteger(nextIdKey) + 1;
            Storage.Put(Storage.CurrentContext, nextIdKey, listingId);

            ListingInfo listing = new ListingInfo
            {
                ListingId = listingId,
                Seller = seller,
                Asset = asset,
                Price = price,
                Status = STATUS_ACTIVE,
                Buyer = UInt160.Zero,
                CreatedAt = Runtime.Time,
                CompletedAt = 0
            };

            Storage.Put(Storage.CurrentContext, ListingKey(instanceId, listingId), StdLib.Serialize(listing));

            // Update counters
            IncrementCounter(ScopedInstanceKey(PREFIX_ACTIVE_COUNT, instanceId));
            IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_LISTINGS, instanceId));

            byte[] sellerKey = SellerCountKey(instanceId, seller);
            BigInteger sellerCount = ReadBigInteger(sellerKey);
            Storage.Put(Storage.CurrentContext, sellerKey, sellerCount + 1);

            OnListingCreated(instanceId, listingId, seller, asset, price);

            return listingId;
        }

        /// <summary>
        /// Cancel an active listing. The seller must sign or the instance controller
        /// may cancel on behalf of the seller.
        /// </summary>
        public static void CancelListing(string instanceId, BigInteger listingId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(listingId > 0, "invalid listing id");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");

            ListingInfo listing = GetListing(instanceId, listingId);
            ExecutionEngine.Assert(listing.ListingId > 0, "listing not found");
            ExecutionEngine.Assert(listing.Status == STATUS_ACTIVE, "listing not active");

            // Authorization: seller or instance controller
            bool authorized = IsUserAuthorized(listing.Seller) || IsInstanceController(config);
            ExecutionEngine.Assert(authorized, "unauthorized");

            listing.Status = STATUS_CANCELLED;
            listing.CompletedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ListingKey(instanceId, listingId), StdLib.Serialize(listing));

            // Decrement active count
            byte[] activeKey = ScopedInstanceKey(PREFIX_ACTIVE_COUNT, instanceId);
            BigInteger activeCount = ReadBigInteger(activeKey);
            WriteBigInteger(activeKey, activeCount - 1);

            OnListingCancelled(instanceId, listingId, listing.Seller);
        }

        /// <summary>
        /// Purchase an active listing. The buyer must sign the transaction or the
        /// instance controller may facilitate the purchase.
        ///
        /// NOTE: This method records the purchase and emits the event. Actual payment
        /// settlement (GAS transfer, escrow release, etc.) should be handled by the
        /// miniapp's router contract or an escrow module that orchestrates the full
        /// trade flow. This module tracks listing state only.
        /// </summary>
        public static void Purchase(string instanceId, BigInteger listingId, UInt160 buyer)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(listingId > 0, "invalid listing id");
            ValidateAddress(buyer, "buyer");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);

            ListingInfo listing = GetListing(instanceId, listingId);
            ExecutionEngine.Assert(listing.ListingId > 0, "listing not found");
            ExecutionEngine.Assert(listing.Status == STATUS_ACTIVE, "listing not active");
            ExecutionEngine.Assert(listing.Seller != buyer, "seller cannot buy own listing");

            // Authorization: buyer signs or instance controller facilitates
            bool authorized = IsUserAuthorized(buyer) || IsInstanceController(config);
            ExecutionEngine.Assert(authorized, "unauthorized");

            listing.Status = STATUS_SOLD;
            listing.Buyer = buyer;
            listing.CompletedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ListingKey(instanceId, listingId), StdLib.Serialize(listing));

            // Decrement active count
            byte[] activeKey = ScopedInstanceKey(PREFIX_ACTIVE_COUNT, instanceId);
            BigInteger activeCount = ReadBigInteger(activeKey);
            WriteBigInteger(activeKey, activeCount - 1);

            // Increment purchase count
            IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_PURCHASES, instanceId));

            OnListingPurchased(instanceId, listingId, listing.Seller, buyer, listing.Price);
        }

        #endregion

        #region Admin Management

        public static void SetInstanceRegistry(UInt160 registry)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        #endregion
    }
}
