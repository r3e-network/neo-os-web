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
    /// Universal check-in module that any miniapp instance can use.
    ///
    /// MULTI-TENANCY:
    /// All user check-in state (streaks, timestamps, rewards) is namespaced by instance ID.
    /// A single deployed contract serves every miniapp instance that needs check-in mechanics.
    ///
    /// FEATURES:
    /// - Per-user daily check-in tracking scoped by instance
    /// - Current streak and highest streak tracking
    /// - Configurable check-in interval (default: 1 UTC day = 86400 seconds)
    /// - Reward pool management with claim flow
    /// - Instance-level configuration (interval, reward amounts)
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, can initialize/deactivate instances
    /// - Instance controller (owner, operator, or registry caller): configure rewards, manage pool
    /// - End users: check in, claim rewards, query stats
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x10       instance config (per instance)
    /// - 0x20       user last check-in day (per instance + user)
    /// - 0x21       user current streak (per instance + user)
    /// - 0x22       user highest streak (per instance + user)
    /// - 0x23       user total check-ins (per instance + user)
    /// - 0x24       user unclaimed rewards (per instance + user)
    /// - 0x25       user total claimed rewards (per instance + user)
    /// - 0x30       instance total check-ins
    /// - 0x31       instance total unique users
    /// - 0x32       instance total rewards distributed
    /// - 0x33       instance reward pool balance
    /// </summary>
    [DisplayName("CheckinModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped check-in module with streak and reward tracking")]
    [ContractPermission("*", "*")]
    public class CheckinModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_LAST_CHECKIN = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_STREAK = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_HIGHEST = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_CHECKINS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_UNCLAIMED = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_CLAIMED = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_INST_TOTAL_CHECKINS = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_INST_TOTAL_USERS = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_INST_TOTAL_REWARDED = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_INST_REWARD_POOL = new byte[] { 0x33 };

        #endregion

        #region Constants

        /// <summary>Default check-in interval: 1 UTC day in seconds.</summary>
        private const long DEFAULT_INTERVAL_SECONDS = 86400;

        #endregion

        #region Data Structures

        public struct InstanceConfig
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            /// <summary>Check-in interval in seconds. Default: 86400 (1 day).</summary>
            public BigInteger IntervalSeconds;
            /// <summary>Reward amount per qualifying check-in (0 = no rewards).</summary>
            public BigInteger RewardPerCheckin;
            /// <summary>Minimum streak length to qualify for reward.</summary>
            public BigInteger MinStreakForReward;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct UserCheckinStats
        {
            public BigInteger CurrentStreak;
            public BigInteger HighestStreak;
            public BigInteger TotalCheckins;
            public BigInteger LastCheckinPeriod;
            public BigInteger UnclaimedRewards;
            public BigInteger TotalClaimed;
        }

        #endregion

        #region Events

        [DisplayName("CheckedIn")]
        public static event Action<string, UInt160, BigInteger, BigInteger, BigInteger> OnCheckedIn = delegate { };

        [DisplayName("StreakUpdated")]
        public static event Action<string, UInt160, BigInteger, BigInteger, bool> OnStreakUpdated = delegate { };

        [DisplayName("RewardsClaimed")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnRewardsClaimed = delegate { };

        [DisplayName("RewardPoolFunded")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnRewardPoolFunded = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, BigInteger, BigInteger> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("InstanceConfigUpdated")]
        public static event Action<string, BigInteger, BigInteger, BigInteger> OnInstanceConfigUpdated = delegate { };

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
                IntervalSeconds = DEFAULT_INTERVAL_SECONDS,
                RewardPerCheckin = 0,
                MinStreakForReward = 0,
                Active = false,
                UpdatedAt = 0
            };
        }

        // --- Scoped storage key builders ---

        private static byte[] ScopedUserKey(byte[] prefix, string instanceId, UInt160 user)
        {
            return Helper.Concat(prefix,
                (ByteString)((instanceId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] ScopedInstanceKey(byte[] prefix, string instanceId)
        {
            return Helper.Concat(prefix, (ByteString)(instanceId ?? ""));
        }

        private static byte[] ConfigKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE_CONFIG, (ByteString)(instanceId ?? ""));
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
        /// Get the current streak for a user in an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserStreak(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_STREAK, instanceId, user));
        }

        /// <summary>
        /// Get the highest streak ever achieved by a user in an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserHighestStreak(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_HIGHEST, instanceId, user));
        }

        /// <summary>
        /// Get the total number of check-ins by a user in an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserTotalCheckins(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_CHECKINS, instanceId, user));
        }

        /// <summary>
        /// Get the period number (day number) of the user's last check-in.
        /// </summary>
        [Safe]
        public static BigInteger GetUserLastCheckin(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_LAST_CHECKIN, instanceId, user));
        }

        /// <summary>
        /// Get unclaimed reward balance for a user in an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserUnclaimed(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_UNCLAIMED, instanceId, user));
        }

        /// <summary>
        /// Get total rewards claimed by a user in an instance.
        /// </summary>
        [Safe]
        public static BigInteger GetUserTotalClaimed(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return ReadBigInteger(ScopedUserKey(PREFIX_USER_CLAIMED, instanceId, user));
        }

        /// <summary>
        /// Get all user stats in a single call.
        /// </summary>
        [Safe]
        public static UserCheckinStats GetUserStats(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            return new UserCheckinStats
            {
                CurrentStreak = ReadBigInteger(ScopedUserKey(PREFIX_USER_STREAK, instanceId, user)),
                HighestStreak = ReadBigInteger(ScopedUserKey(PREFIX_USER_HIGHEST, instanceId, user)),
                TotalCheckins = ReadBigInteger(ScopedUserKey(PREFIX_USER_CHECKINS, instanceId, user)),
                LastCheckinPeriod = ReadBigInteger(ScopedUserKey(PREFIX_USER_LAST_CHECKIN, instanceId, user)),
                UnclaimedRewards = ReadBigInteger(ScopedUserKey(PREFIX_USER_UNCLAIMED, instanceId, user)),
                TotalClaimed = ReadBigInteger(ScopedUserKey(PREFIX_USER_CLAIMED, instanceId, user))
            };
        }

        /// <summary>
        /// Get instance-wide aggregate statistics.
        /// </summary>
        [Safe]
        public static BigInteger GetInstanceTotalCheckins(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_CHECKINS, instanceId));
        }

        [Safe]
        public static BigInteger GetInstanceTotalUsers(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_USERS, instanceId));
        }

        [Safe]
        public static BigInteger GetInstanceTotalRewarded(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_TOTAL_REWARDED, instanceId));
        }

        [Safe]
        public static BigInteger GetInstanceRewardPool(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadBigInteger(ScopedInstanceKey(PREFIX_INST_REWARD_POOL, instanceId));
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure a check-in instance.
        /// </summary>
        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress,
            BigInteger intervalSeconds,
            BigInteger rewardPerCheckin,
            BigInteger minStreakForReward)
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

            BigInteger normalizedInterval = intervalSeconds > 0 ? intervalSeconds : DEFAULT_INTERVAL_SECONDS;
            ExecutionEngine.Assert(normalizedInterval >= 60, "interval must be >= 60 seconds");
            ExecutionEngine.Assert(rewardPerCheckin >= 0, "reward cannot be negative");
            ExecutionEngine.Assert(minStreakForReward >= 0, "min streak cannot be negative");

            InstanceConfig config = new InstanceConfig
            {
                InstanceId = instanceId,
                Owner = owner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                IntervalSeconds = normalizedInterval,
                RewardPerCheckin = rewardPerCheckin,
                MinStreakForReward = minStreakForReward,
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceInitialized(instanceId, owner, normalizedInterval, rewardPerCheckin);
        }

        /// <summary>
        /// Update reward configuration for an existing instance.
        /// </summary>
        public static void UpdateInstanceConfig(
            string instanceId,
            BigInteger intervalSeconds,
            BigInteger rewardPerCheckin,
            BigInteger minStreakForReward)
        {
            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            BigInteger normalizedInterval = intervalSeconds > 0 ? intervalSeconds : DEFAULT_INTERVAL_SECONDS;
            ExecutionEngine.Assert(normalizedInterval >= 60, "interval must be >= 60 seconds");
            ExecutionEngine.Assert(rewardPerCheckin >= 0, "reward cannot be negative");
            ExecutionEngine.Assert(minStreakForReward >= 0, "min streak cannot be negative");

            config.IntervalSeconds = normalizedInterval;
            config.RewardPerCheckin = rewardPerCheckin;
            config.MinStreakForReward = minStreakForReward;
            config.UpdatedAt = Runtime.Time;

            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceConfigUpdated(instanceId, normalizedInterval, rewardPerCheckin, minStreakForReward);
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

        #region Check-in

        /// <summary>
        /// Perform a check-in for the given user within the specified instance.
        /// User must sign the transaction (CheckWitness).
        /// </summary>
        public static void CheckIn(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            ExecutionEngine.Assert(IsUserAuthorized(user), "unauthorized");

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);

            BigInteger interval = config.IntervalSeconds;
            BigInteger currentPeriod = Runtime.Time / interval;

            // Read user state
            byte[] lastCheckinKey = ScopedUserKey(PREFIX_USER_LAST_CHECKIN, instanceId, user);
            byte[] streakKey = ScopedUserKey(PREFIX_USER_STREAK, instanceId, user);
            byte[] highestKey = ScopedUserKey(PREFIX_USER_HIGHEST, instanceId, user);
            byte[] checkinsKey = ScopedUserKey(PREFIX_USER_CHECKINS, instanceId, user);

            BigInteger lastCheckinPeriod = ReadBigInteger(lastCheckinKey);
            BigInteger currentStreak = ReadBigInteger(streakKey);
            BigInteger highestStreak = ReadBigInteger(highestKey);
            BigInteger totalCheckins = ReadBigInteger(checkinsKey);

            bool isNewUser = lastCheckinPeriod == 0;

            if (!isNewUser)
            {
                // Prevent double check-in within same period
                ExecutionEngine.Assert(currentPeriod > lastCheckinPeriod, "already checked in this period");

                // Detect streak break (missed more than one period)
                if (currentPeriod > lastCheckinPeriod + 1)
                {
                    // Save highest if current was higher
                    if (currentStreak > highestStreak)
                    {
                        highestStreak = currentStreak;
                        WriteBigInteger(highestKey, highestStreak);
                    }

                    bool wasReset = currentStreak > 0;
                    currentStreak = 0;

                    if (wasReset)
                    {
                        OnStreakUpdated(instanceId, user, 0, highestStreak, true);
                    }
                }
            }

            // Increment streak
            currentStreak += 1;

            // Calculate and accumulate reward
            BigInteger reward = 0;
            if (config.RewardPerCheckin > 0 && currentStreak >= config.MinStreakForReward)
            {
                // Check if reward pool has sufficient funds
                BigInteger pool = ReadBigInteger(ScopedInstanceKey(PREFIX_INST_REWARD_POOL, instanceId));
                if (pool >= config.RewardPerCheckin)
                {
                    reward = config.RewardPerCheckin;
                    // Deduct from pool
                    WriteBigInteger(ScopedInstanceKey(PREFIX_INST_REWARD_POOL, instanceId), pool - reward);

                    // Add to user unclaimed
                    byte[] unclaimedKey = ScopedUserKey(PREFIX_USER_UNCLAIMED, instanceId, user);
                    BigInteger unclaimed = ReadBigInteger(unclaimedKey);
                    WriteBigInteger(unclaimedKey, unclaimed + reward);

                    // Update instance-wide rewarded total
                    byte[] rewardedKey = ScopedInstanceKey(PREFIX_INST_TOTAL_REWARDED, instanceId);
                    BigInteger totalRewarded = ReadBigInteger(rewardedKey);
                    Storage.Put(Storage.CurrentContext, rewardedKey, totalRewarded + reward);
                }
            }

            // Persist user state
            Storage.Put(Storage.CurrentContext, lastCheckinKey, currentPeriod);
            WriteBigInteger(streakKey, currentStreak);
            Storage.Put(Storage.CurrentContext, checkinsKey, totalCheckins + 1);

            // Update highest streak
            if (currentStreak > highestStreak)
            {
                WriteBigInteger(highestKey, currentStreak);
            }

            // Update instance-wide counters
            IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_CHECKINS, instanceId));

            if (isNewUser)
            {
                IncrementCounter(ScopedInstanceKey(PREFIX_INST_TOTAL_USERS, instanceId));
            }

            BigInteger nextEligible = (currentPeriod + 1) * interval;
            OnCheckedIn(instanceId, user, currentStreak, reward, nextEligible);
            OnStreakUpdated(instanceId, user, currentStreak, highestStreak > currentStreak ? highestStreak : currentStreak, false);
        }

        #endregion

        #region Rewards

        /// <summary>
        /// Fund the reward pool for an instance by sending GAS.
        /// Accepts GAS via NEP-17 OnNEP17Payment with instanceId in memo.
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data != null, "instanceId required in data");

            string instanceId;
            if (data is string text)
            {
                instanceId = text ?? "";
            }
            else if (data is ByteString bs)
            {
                instanceId = (string)bs;
            }
            else
            {
                instanceId = "";
            }

            ValidateIdentifier(instanceId, "instance id");
            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);

            // Add to reward pool
            byte[] poolKey = ScopedInstanceKey(PREFIX_INST_REWARD_POOL, instanceId);
            BigInteger current = ReadBigInteger(poolKey);
            BigInteger next = current + amount;
            Storage.Put(Storage.CurrentContext, poolKey, next);

            OnRewardPoolFunded(instanceId, from, amount, next);
        }

        /// <summary>
        /// Claim accumulated unclaimed rewards. User must sign.
        /// Transfers GAS from this contract to the user.
        /// </summary>
        public static void ClaimRewards(string instanceId, UInt160 user)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(user, "user");
            ExecutionEngine.Assert(IsUserAuthorized(user), "unauthorized");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");

            byte[] unclaimedKey = ScopedUserKey(PREFIX_USER_UNCLAIMED, instanceId, user);
            BigInteger unclaimed = ReadBigInteger(unclaimedKey);
            ExecutionEngine.Assert(unclaimed > 0, "no rewards to claim");

            byte[] claimedKey = ScopedUserKey(PREFIX_USER_CLAIMED, instanceId, user);
            BigInteger totalClaimed = ReadBigInteger(claimedKey);

            // Transfer GAS to user
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, user, unclaimed, null);
            ExecutionEngine.Assert(transferred, "reward transfer failed");

            // Update state
            WriteBigInteger(unclaimedKey, 0);
            Storage.Put(Storage.CurrentContext, claimedKey, totalClaimed + unclaimed);

            OnRewardsClaimed(instanceId, user, unclaimed, totalClaimed + unclaimed);
        }

        /// <summary>
        /// Withdraw excess reward pool funds. Only instance controller may call.
        /// </summary>
        public static void WithdrawRewardPool(string instanceId, BigInteger amount, UInt160 recipient)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(recipient, "recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            byte[] poolKey = ScopedInstanceKey(PREFIX_INST_REWARD_POOL, instanceId);
            BigInteger pool = ReadBigInteger(poolKey);
            ExecutionEngine.Assert(pool >= amount, "insufficient reward pool");

            WriteBigInteger(poolKey, pool - amount);

            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, recipient, amount, null);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");
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
