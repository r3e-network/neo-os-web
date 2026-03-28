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
    /// Universal random allocation module for fair distribution of items/rewards using VRF.
    ///
    /// MULTI-TENANCY:
    /// All allocation pools are namespaced by instance ID. A single deployed contract
    /// serves every miniapp instance that needs random allocation mechanics (gacha, raffles,
    /// fair item distribution, etc.).
    ///
    /// ALLOCATION FLOW:
    /// 1. Instance controller creates an allocation pool with a participant count
    /// 2. requestAllocation() emits AllocationRequested for off-chain VRF to pick up
    /// 3. Off-chain oracle/VRF generates a random seed and calls resolveAllocation()
    /// 4. resolveAllocation() uses the seed to deterministically assign indices to slots
    /// 5. Participants query their assignment via getAllocation()
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or registry caller): manage pools, resolve
    /// - End users: query allocations
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       pool info (per instance + poolId)
    /// - 0x21       pool allocation results (per instance + poolId)
    /// - 0x22       pool status (per instance + poolId)
    /// - 0x30       instance total pools
    /// </summary>
    [DisplayName("RandomAllocationModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped random allocation module with VRF-based fair distribution")]
    [ContractPermission("*", "*")]
    public class RandomAllocationModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_POOL_INFO = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_POOL_RESULTS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_POOL_STATUS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_INST_TOTAL_POOLS = new byte[] { 0x30 };

        #endregion

        #region Constants

        /// <summary>Pool status: pending random seed.</summary>
        public const byte STATUS_PENDING = 0;

        /// <summary>Pool status: resolved with allocations assigned.</summary>
        public const byte STATUS_RESOLVED = 1;

        /// <summary>Pool status: cancelled.</summary>
        public const byte STATUS_CANCELLED = 2;

        /// <summary>Maximum participants per pool.</summary>
        private const int MAX_PARTICIPANTS = 1000;

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

        public struct PoolInfo
        {
            public string PoolId;
            public BigInteger ParticipantCount;
            public BigInteger RandomSeed;
            public byte Status;
            public BigInteger CreatedAt;
            public BigInteger ResolvedAt;
        }

        #endregion

        #region Events

        [DisplayName("AllocationRequested")]
        public static event Action<string, string, BigInteger, BigInteger> OnAllocationRequested = delegate { };

        [DisplayName("AllocationResolved")]
        public static event Action<string, string, BigInteger, BigInteger> OnAllocationResolved = delegate { };

        [DisplayName("AllocationClaimed")]
        public static event Action<string, string, BigInteger, BigInteger> OnAllocationClaimed = delegate { };

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

        private static byte[] PoolKey(string instanceId, string poolId)
        {
            return Helper.Concat(PREFIX_POOL_INFO,
                (ByteString)((instanceId ?? "") + "|" + (poolId ?? "")));
        }

        private static byte[] PoolResultsKey(string instanceId, string poolId)
        {
            return Helper.Concat(PREFIX_POOL_RESULTS,
                (ByteString)((instanceId ?? "") + "|" + (poolId ?? "")));
        }

        private static byte[] PoolStatusKey(string instanceId, string poolId)
        {
            return Helper.Concat(PREFIX_POOL_STATUS,
                (ByteString)((instanceId ?? "") + "|" + (poolId ?? "")));
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
        /// Get pool information for a specific allocation pool.
        /// </summary>
        [Safe]
        public static PoolInfo GetPoolStatus(string instanceId, string poolId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(poolId, "pool id");

            ByteString? raw = Storage.Get(Storage.CurrentContext, PoolKey(instanceId, poolId));
            if (raw == null)
            {
                return new PoolInfo
                {
                    PoolId = "",
                    ParticipantCount = 0,
                    RandomSeed = 0,
                    Status = STATUS_PENDING,
                    CreatedAt = 0,
                    ResolvedAt = 0
                };
            }
            return (PoolInfo)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the allocation result for a specific participant index within a resolved pool.
        /// Returns the shuffled slot index assigned to the participant.
        /// </summary>
        [Safe]
        public static BigInteger GetAllocation(string instanceId, string poolId, BigInteger participantIndex)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(poolId, "pool id");
            ExecutionEngine.Assert(participantIndex >= 0, "participant index cannot be negative");

            PoolInfo pool = GetPoolStatus(instanceId, poolId);
            ExecutionEngine.Assert(pool.PoolId.Length > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_RESOLVED, "pool not yet resolved");
            ExecutionEngine.Assert(participantIndex < pool.ParticipantCount, "participant index out of range");

            // Deterministic allocation: use (seed + participantIndex) mod participantCount
            // to create a Fisher-Yates-like mapping
            // For on-chain efficiency, we use a hash-based assignment:
            // allocation[i] = (seed + i * prime) mod participantCount
            // where prime is a large prime to ensure good distribution
            BigInteger seed = pool.RandomSeed;
            BigInteger count = pool.ParticipantCount;

            // Use a deterministic permutation: slot = (seed + index * 7919) % count
            // 7919 is prime, ensuring full cycle when gcd(7919, count) = 1 for most counts
            BigInteger slot = (seed + participantIndex * 7919) % count;
            if (slot < 0) slot += count;

            return slot;
        }

        /// <summary>
        /// Get the total number of allocation pools created for an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetInstanceTotalPools(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_POOLS, instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a random allocation instance.
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

        #region Allocation Operations

        /// <summary>
        /// Request a new random allocation pool. Creates the pool in PENDING status
        /// and emits AllocationRequested for off-chain VRF oracle to pick up.
        /// Only instance controller may call.
        /// </summary>
        public static void RequestAllocation(string instanceId, string poolId, BigInteger participantCount)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(poolId, "pool id");
            ExecutionEngine.Assert(participantCount > 0, "participant count must be > 0");
            ExecutionEngine.Assert(participantCount <= MAX_PARTICIPANTS, "participant count exceeds maximum");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            // Ensure pool does not already exist
            PoolInfo existing = GetPoolStatus(instanceId, poolId);
            ExecutionEngine.Assert(existing.PoolId.Length == 0, "pool already exists");

            PoolInfo pool = new PoolInfo
            {
                PoolId = poolId,
                ParticipantCount = participantCount,
                RandomSeed = 0,
                Status = STATUS_PENDING,
                CreatedAt = Runtime.Time,
                ResolvedAt = 0
            };

            Storage.Put(Storage.CurrentContext, PoolKey(instanceId, poolId), StdLib.Serialize(pool));
            IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_POOLS, instanceId));

            OnAllocationRequested(instanceId, poolId, participantCount, Runtime.Time);
        }

        /// <summary>
        /// Resolve an allocation pool with a VRF-generated random seed.
        /// This deterministically assigns slots to all participants.
        /// Only instance controller may call.
        /// </summary>
        public static void ResolveAllocation(string instanceId, string poolId, BigInteger randomSeed)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(poolId, "pool id");
            ExecutionEngine.Assert(randomSeed > 0, "random seed must be > 0");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            PoolInfo pool = GetPoolStatus(instanceId, poolId);
            ExecutionEngine.Assert(pool.PoolId.Length > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_PENDING, "pool not in pending status");

            pool.RandomSeed = randomSeed;
            pool.Status = STATUS_RESOLVED;
            pool.ResolvedAt = Runtime.Time;

            Storage.Put(Storage.CurrentContext, PoolKey(instanceId, poolId), StdLib.Serialize(pool));

            OnAllocationResolved(instanceId, poolId, randomSeed, pool.ParticipantCount);
        }

        /// <summary>
        /// Cancel a pending allocation pool. Only instance controller may call.
        /// Cannot cancel already resolved pools.
        /// </summary>
        public static void CancelAllocation(string instanceId, string poolId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(poolId, "pool id");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            PoolInfo pool = GetPoolStatus(instanceId, poolId);
            ExecutionEngine.Assert(pool.PoolId.Length > 0, "pool not found");
            ExecutionEngine.Assert(pool.Status == STATUS_PENDING, "can only cancel pending pools");

            pool.Status = STATUS_CANCELLED;
            Storage.Put(Storage.CurrentContext, PoolKey(instanceId, poolId), StdLib.Serialize(pool));
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
