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
    /// Universal NFT-based ticketing module for events, passes, and memberships.
    ///
    /// MULTI-TENANCY:
    /// All token state is namespaced by instance ID. A single deployed contract
    /// serves every miniapp instance that needs NFT ticket mechanics.
    ///
    /// FEATURES:
    /// - Mint tickets with arbitrary metadata (JSON string)
    /// - Transfer tickets between users
    /// - Burn tickets (e.g., ticket used, expired)
    /// - Per-instance token ID counter and total supply tracking
    /// - Balance queries per owner per instance
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or registry caller): mint, burn, manage
    /// - Token holders: transfer their own tokens
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       token owner (per instance + tokenId)
    /// - 0x21       token metadata (per instance + tokenId)
    /// - 0x22       owner balance (per instance + owner)
    /// - 0x30       instance total supply
    /// - 0x31       instance next token id counter
    /// </summary>
    [DisplayName("TicketNFTModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped NFT ticketing module for events, passes, and memberships")]
    [ContractPermission("*", "*")]
    public class TicketNFTModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOKEN_OWNER = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOKEN_METADATA = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_OWNER_BALANCE = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_INST_TOTAL_SUPPLY = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_INST_NEXT_TOKEN_ID = new byte[] { 0x31 };

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

        public struct TokenInfo
        {
            public BigInteger TokenId;
            public UInt160 Owner;
            public string Metadata;
            public BigInteger MintedAt;
        }

        #endregion

        #region Events

        [DisplayName("TicketMinted")]
        public static event Action<string, UInt160, BigInteger, string> OnTicketMinted = delegate { };

        [DisplayName("TicketBurned")]
        public static event Action<string, BigInteger, UInt160> OnTicketBurned = delegate { };

        [DisplayName("TicketTransferred")]
        public static event Action<string, UInt160, UInt160, BigInteger> OnTicketTransferred = delegate { };

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

        private static byte[] TokenOwnerKey(string instanceId, BigInteger tokenId)
        {
            return Helper.Concat(PREFIX_TOKEN_OWNER,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)tokenId));
        }

        private static byte[] TokenMetadataKey(string instanceId, BigInteger tokenId)
        {
            return Helper.Concat(PREFIX_TOKEN_METADATA,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)tokenId));
        }

        private static byte[] OwnerBalanceKey(string instanceId, UInt160 owner)
        {
            return Helper.Concat(PREFIX_OWNER_BALANCE,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])owner));
        }

        private static byte[] ScopedInstanceKey(byte[] prefix, string instanceId)
        {
            return Helper.Concat(prefix, (ByteString)(instanceId ?? ""));
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
        /// Get token information including owner and metadata.
        /// </summary>
        [Safe]
        public static TokenInfo GetToken(string instanceId, BigInteger tokenId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(tokenId > 0, "invalid token id");

            byte[] ownerKey = TokenOwnerKey(instanceId, tokenId);
            ByteString? ownerRaw = Storage.Get(Storage.CurrentContext, ownerKey);
            if (ownerRaw == null || ownerRaw.Length == 0)
            {
                return new TokenInfo
                {
                    TokenId = 0,
                    Owner = UInt160.Zero,
                    Metadata = "",
                    MintedAt = 0
                };
            }

            byte[] metaKey = TokenMetadataKey(instanceId, tokenId);
            ByteString? metaRaw = Storage.Get(Storage.CurrentContext, metaKey);
            string metadata = metaRaw == null ? "" : (string)metaRaw;

            return new TokenInfo
            {
                TokenId = tokenId,
                Owner = (UInt160)ownerRaw,
                Metadata = metadata,
                MintedAt = 0
            };
        }

        /// <summary>
        /// Get the ticket balance for an owner within an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetBalance(string instanceId, UInt160 owner)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");
            return ReadBigInteger(OwnerBalanceKey(instanceId, owner));
        }

        /// <summary>
        /// Get the total supply of tickets for an instance.
        /// </summary>
        [Safe]
        public static BigInteger TotalSupply(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_SUPPLY, instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a ticket NFT instance.
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

        #region Token Operations

        /// <summary>
        /// Mint a new ticket NFT. Only instance controller may call.
        /// Returns the newly assigned token ID.
        /// </summary>
        public static BigInteger Mint(string instanceId, UInt160 to, string metadata)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(to, "to");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            // Allocate next token ID
            byte[] nextIdKey = ScopedInstanceKey(PREFIX_INST_NEXT_TOKEN_ID, instanceId);
            BigInteger tokenId = ReadBigInteger(nextIdKey) + 1;
            Storage.Put(Storage.CurrentContext, nextIdKey, tokenId);

            // Set owner
            Storage.Put(Storage.CurrentContext, TokenOwnerKey(instanceId, tokenId), to);

            // Set metadata
            string normalizedMeta = metadata ?? "";
            if (normalizedMeta.Length > 0)
            {
                Storage.Put(Storage.CurrentContext, TokenMetadataKey(instanceId, tokenId), normalizedMeta);
            }

            // Increment owner balance
            byte[] balanceKey = OwnerBalanceKey(instanceId, to);
            BigInteger balance = ReadBigInteger(balanceKey);
            Storage.Put(Storage.CurrentContext, balanceKey, balance + 1);

            // Increment total supply
            byte[] supplyKey = ScopedInstanceKey(PREFIX_INST_TOTAL_SUPPLY, instanceId);
            BigInteger supply = ReadBigInteger(supplyKey);
            Storage.Put(Storage.CurrentContext, supplyKey, supply + 1);

            OnTicketMinted(instanceId, to, tokenId, normalizedMeta);

            return tokenId;
        }

        /// <summary>
        /// Burn a ticket NFT. Only instance controller may call.
        /// </summary>
        public static void Burn(string instanceId, BigInteger tokenId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ExecutionEngine.Assert(tokenId > 0, "invalid token id");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            // Get current owner
            byte[] ownerKey = TokenOwnerKey(instanceId, tokenId);
            ByteString? ownerRaw = Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(ownerRaw != null && ownerRaw.Length > 0, "token does not exist");
            UInt160 owner = (UInt160)ownerRaw;

            // Remove token owner
            Storage.Delete(Storage.CurrentContext, ownerKey);

            // Remove metadata
            Storage.Delete(Storage.CurrentContext, TokenMetadataKey(instanceId, tokenId));

            // Decrement owner balance
            byte[] balanceKey = OwnerBalanceKey(instanceId, owner);
            BigInteger balance = ReadBigInteger(balanceKey);
            WriteBigInteger(balanceKey, balance - 1);

            // Decrement total supply
            byte[] supplyKey = ScopedInstanceKey(PREFIX_INST_TOTAL_SUPPLY, instanceId);
            BigInteger supply = ReadBigInteger(supplyKey);
            WriteBigInteger(supplyKey, supply - 1);

            OnTicketBurned(instanceId, tokenId, owner);
        }

        /// <summary>
        /// Transfer a ticket NFT between addresses.
        /// The sender must be the token owner (CheckWitness) or the instance controller.
        /// </summary>
        public static void Transfer(string instanceId, UInt160 from, UInt160 to, BigInteger tokenId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(from, "from");
            ValidateAddress(to, "to");
            ExecutionEngine.Assert(tokenId > 0, "invalid token id");
            ExecutionEngine.Assert(from != to, "cannot transfer to self");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);

            // Authorization: token owner or instance controller
            bool authorized = IsUserAuthorized(from) || IsInstanceController(config);
            ExecutionEngine.Assert(authorized, "unauthorized");

            // Verify current owner
            byte[] ownerKey = TokenOwnerKey(instanceId, tokenId);
            ByteString? ownerRaw = Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(ownerRaw != null && ownerRaw.Length > 0, "token does not exist");
            UInt160 currentOwner = (UInt160)ownerRaw;
            ExecutionEngine.Assert(currentOwner == from, "from is not the token owner");

            // Update owner
            Storage.Put(Storage.CurrentContext, ownerKey, to);

            // Update balances
            byte[] fromBalanceKey = OwnerBalanceKey(instanceId, from);
            BigInteger fromBalance = ReadBigInteger(fromBalanceKey);
            WriteBigInteger(fromBalanceKey, fromBalance - 1);

            byte[] toBalanceKey = OwnerBalanceKey(instanceId, to);
            BigInteger toBalance = ReadBigInteger(toBalanceKey);
            Storage.Put(Storage.CurrentContext, toBalanceKey, toBalance + 1);

            OnTicketTransferred(instanceId, from, to, tokenId);
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
