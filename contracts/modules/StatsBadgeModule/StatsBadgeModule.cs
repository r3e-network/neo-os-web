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
    /// Universal achievement badge and stats tracking module.
    ///
    /// MULTI-TENANCY:
    /// All badge definitions, awards, and stats are namespaced by instance ID.
    /// A single deployed contract serves every miniapp instance that needs
    /// achievement/badge/stat mechanics.
    ///
    /// FEATURES:
    /// - Define badges with name and criteria (arbitrary string metadata)
    /// - Award and revoke badges to/from users
    /// - Track arbitrary numeric stats per user (e.g., "games_played", "total_score")
    /// - Query badge ownership and stat values
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or registry caller): define badges, award, revoke, update stats
    /// - End users: query their own badges and stats
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       badge definition (per instance + badgeId)
    /// - 0x21       user badge flag (per instance + badgeId + user)
    /// - 0x22       user badge count (per instance + user)
    /// - 0x23       user stat value (per instance + user + statKey)
    /// - 0x30       instance total badges defined
    /// - 0x31       instance total badges awarded
    /// </summary>
    [DisplayName("StatsBadgeModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped achievement badge and stats tracking module")]
    [ContractPermission("*", "*")]
    public class StatsBadgeModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BADGE_DEF = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_BADGE = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_BADGE_COUNT = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_STAT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_INST_TOTAL_BADGES = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_INST_TOTAL_AWARDED = new byte[] { 0x31 };

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

        public struct BadgeDefinition
        {
            public string BadgeId;
            public string Name;
            /// <summary>Criteria description or JSON metadata for earning this badge.</summary>
            public string Criteria;
            public BigInteger CreatedAt;
        }

        #endregion

        #region Events

        [DisplayName("BadgeDefined")]
        public static event Action<string, string, string, string> OnBadgeDefined = delegate { };

        [DisplayName("BadgeAwarded")]
        public static event Action<string, string, UInt160, BigInteger> OnBadgeAwarded = delegate { };

        [DisplayName("BadgeRevoked")]
        public static event Action<string, string, UInt160, BigInteger> OnBadgeRevoked = delegate { };

        [DisplayName("StatUpdated")]
        public static event Action<string, UInt160, string, BigInteger, BigInteger> OnStatUpdated = delegate { };

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

        private static byte[] BadgeDefKey(string instanceId, string badgeId)
        {
            return Helper.Concat(PREFIX_BADGE_DEF,
                (ByteString)((instanceId ?? "") + "|" + (badgeId ?? "")));
        }

        private static byte[] UserBadgeKey(string instanceId, string badgeId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_BADGE,
                (ByteString)((instanceId ?? "") + "|" + (badgeId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] UserBadgeCountKey(string instanceId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_BADGE_COUNT,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] UserStatKey(string instanceId, UInt160 user, string statKey)
        {
            return Helper.Concat(PREFIX_USER_STAT,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])user + "|" + (statKey ?? "")));
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
        /// Get badge definition by ID.
        /// </summary>
        [Safe]
        public static BadgeDefinition GetBadgeDefinition(string instanceId, string badgeId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(badgeId, "badge id");

            ByteString? raw = Storage.Get(Storage.CurrentContext, BadgeDefKey(instanceId, badgeId));
            if (raw == null)
            {
                return new BadgeDefinition
                {
                    BadgeId = "",
                    Name = "",
                    Criteria = "",
                    CreatedAt = 0
                };
            }
            return (BadgeDefinition)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Check whether a user has a specific badge.
        /// </summary>
        [Safe]
        public static bool HasBadge(string instanceId, string badgeId, UInt160 address)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(badgeId, "badge id");
            ValidateAddress(address, "address");

            ByteString? raw = Storage.Get(Storage.CurrentContext, UserBadgeKey(instanceId, badgeId, address));
            return raw != null && (BigInteger)raw == 1;
        }

        /// <summary>
        /// Get the total number of badges a user holds for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserBadges(string instanceId, UInt160 address)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(address, "address");
            return ReadBigInteger(UserBadgeCountKey(instanceId, address));
        }

        /// <summary>
        /// Get a user's stat value for a specific stat key.
        /// </summary>
        [Safe]
        public static BigInteger GetStat(string instanceId, UInt160 address, string statKey)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(address, "address");
            ValidateIdentifier(statKey, "stat key");
            return ReadBigInteger(UserStatKey(instanceId, address, statKey));
        }

        /// <summary>
        /// Get the total number of badge types defined for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalBadgesDefined(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_BADGES, instanceId));
        }

        /// <summary>
        /// Get the total number of badge awards across all users for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalBadgesAwarded(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_AWARDED, instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a stats/badge instance.
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

        #region Badge Operations

        /// <summary>
        /// Define a new badge type for an instance. Only instance controller may call.
        /// If a badge with the same ID already exists, it will be updated.
        /// </summary>
        public static void DefineBadge(string instanceId, string badgeId, string name, string criteria)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(badgeId, "badge id");
            ExecutionEngine.Assert(name != null && name.Length > 0, "badge name required");
            ExecutionEngine.Assert(name.Length <= 256, "badge name too long");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            BadgeDefinition existing = GetBadgeDefinition(instanceId, badgeId);
            bool isNew = existing.BadgeId.Length == 0;

            BadgeDefinition badge = new BadgeDefinition
            {
                BadgeId = badgeId,
                Name = name,
                Criteria = criteria ?? "",
                CreatedAt = isNew ? Runtime.Time : existing.CreatedAt
            };

            Storage.Put(Storage.CurrentContext, BadgeDefKey(instanceId, badgeId), StdLib.Serialize(badge));

            if (isNew)
            {
                IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_BADGES, instanceId));
            }

            OnBadgeDefined(instanceId, badgeId, name, criteria ?? "");
        }

        /// <summary>
        /// Award a badge to a user. Only instance controller may call.
        /// If the user already has the badge, this is a no-op.
        /// </summary>
        public static void AwardBadge(string instanceId, string badgeId, UInt160 recipient)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(badgeId, "badge id");
            ValidateAddress(recipient, "recipient");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            // Verify badge is defined
            BadgeDefinition badge = GetBadgeDefinition(instanceId, badgeId);
            ExecutionEngine.Assert(badge.BadgeId.Length > 0, "badge not defined");

            // Check if already awarded
            byte[] userBadgeKey = UserBadgeKey(instanceId, badgeId, recipient);
            ByteString? existing = Storage.Get(Storage.CurrentContext, userBadgeKey);
            if (existing != null && (BigInteger)existing == 1)
            {
                return; // Already has badge, no-op
            }

            // Award the badge
            Storage.Put(Storage.CurrentContext, userBadgeKey, 1);

            // Increment user badge count
            byte[] countKey = UserBadgeCountKey(instanceId, recipient);
            BigInteger count = ReadBigInteger(countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Increment instance-wide awarded count
            IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_AWARDED, instanceId));

            OnBadgeAwarded(instanceId, badgeId, recipient, Runtime.Time);
        }

        /// <summary>
        /// Revoke a badge from a user. Only instance controller may call.
        /// If the user does not have the badge, this is a no-op.
        /// </summary>
        public static void RevokeBadge(string instanceId, string badgeId, UInt160 recipient)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(badgeId, "badge id");
            ValidateAddress(recipient, "recipient");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            // Check if badge is awarded
            byte[] userBadgeKey = UserBadgeKey(instanceId, badgeId, recipient);
            ByteString? existing = Storage.Get(Storage.CurrentContext, userBadgeKey);
            if (existing == null || (BigInteger)existing != 1)
            {
                return; // Does not have badge, no-op
            }

            // Revoke the badge
            Storage.Delete(Storage.CurrentContext, userBadgeKey);

            // Decrement user badge count
            byte[] countKey = UserBadgeCountKey(instanceId, recipient);
            BigInteger count = ReadBigInteger(countKey);
            WriteBigInteger(countKey, count - 1);

            OnBadgeRevoked(instanceId, badgeId, recipient, Runtime.Time);
        }

        #endregion

        #region Stat Operations

        /// <summary>
        /// Increment a user's stat by the given amount. Only instance controller may call.
        /// Creates the stat if it does not exist (starting from 0).
        /// </summary>
        public static void IncrementStat(string instanceId, UInt160 address, string statKey, BigInteger amount)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(address, "address");
            ValidateIdentifier(statKey, "stat key");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            byte[] key = UserStatKey(instanceId, address, statKey);
            BigInteger current = ReadBigInteger(key);
            BigInteger next = current + amount;
            Storage.Put(Storage.CurrentContext, key, next);

            OnStatUpdated(instanceId, address, statKey, next, amount);
        }

        /// <summary>
        /// Set a user's stat to a specific value. Only instance controller may call.
        /// Useful for stats that should be replaced rather than incremented.
        /// </summary>
        public static void SetStat(string instanceId, UInt160 address, string statKey, BigInteger value)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(address, "address");
            ValidateIdentifier(statKey, "stat key");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            byte[] key = UserStatKey(instanceId, address, statKey);
            BigInteger previous = ReadBigInteger(key);

            if (value <= 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, value);
            }

            OnStatUpdated(instanceId, address, statKey, value, value - previous);
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
