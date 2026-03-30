using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void CheckedInHandler(string appId, UInt160 user, BigInteger streak, BigInteger reward, BigInteger nextEligible);
    public delegate void RewardsClaimedHandler(string appId, UInt160 user, BigInteger amount, BigInteger totalClaimed);
    public delegate void RewardPoolFundedHandler(string appId, UInt160 funder, BigInteger amount, BigInteger newPoolBalance);
    public delegate void AppConfiguredHandler(string appId, BigInteger intervalSeconds, BigInteger rewardPerCheckin);
    public delegate void CheckinAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("CheckinService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS CheckinService — app-scoped daily check-in with streak and reward tracking")]
    [ContractPermission("*", "*")]
    public class CheckinService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN          = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE  = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_CONFIG     = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_STATS     = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_APP_STATS      = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_REWARD_POOL    = new byte[] { 0x40 };

        // ── Constants ─────────────────────────────────────────────────────
        private const long DEFAULT_INTERVAL_SECONDS = 86400;

        // ── Structs ───────────────────────────────────────────────────────
        public struct AppConfig
        {
            public string AppId;
            public BigInteger IntervalSeconds;
            public BigInteger RewardPerCheckin;
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

        public struct AppStats
        {
            public BigInteger TotalCheckins;
            public BigInteger TotalUniqueUsers;
            public BigInteger TotalRewarded;
            public BigInteger RewardPoolBalance;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("CheckedIn")]
        public static event CheckedInHandler OnCheckedIn = delegate { };

        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed = delegate { };

        [DisplayName("RewardPoolFunded")]
        public static event RewardPoolFundedHandler OnRewardPoolFunded = delegate { };

        [DisplayName("AppConfigured")]
        public static event AppConfiguredHandler OnAppConfigured = delegate { };

        [DisplayName("AdminChanged")]
        public static event CheckinAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ─────────────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin Management ──────────────────────────────────────────────

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Configuration ─────────────────────────────────────────────────

        public static void Configure(string appId, BigInteger intervalSeconds, BigInteger rewardPerCheckin, BigInteger minStreakForReward)
        {
            ValidateAppId(appId);
            ValidateAdmin();

            BigInteger normalizedInterval = intervalSeconds > 0 ? intervalSeconds : DEFAULT_INTERVAL_SECONDS;
            ExecutionEngine.Assert(normalizedInterval >= 60, "interval must be >= 60 seconds");
            ExecutionEngine.Assert(rewardPerCheckin >= 0, "reward cannot be negative");
            ExecutionEngine.Assert(minStreakForReward >= 0, "min streak cannot be negative");

            AppConfig config = new AppConfig
            {
                AppId = appId,
                IntervalSeconds = normalizedInterval,
                RewardPerCheckin = rewardPerCheckin,
                MinStreakForReward = minStreakForReward,
                Active = true,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, AppConfigKey(appId), StdLib.Serialize(config));
            OnAppConfigured(appId, normalizedInterval, rewardPerCheckin);
        }

        // ── Check-in ──────────────────────────────────────────────────────

        public static void CheckIn(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");

            AppConfig config = GetConfigInternal(appId);
            ExecutionEngine.Assert(config.AppId.Length > 0, "app not configured");
            ExecutionEngine.Assert(config.Active, "app inactive");

            BigInteger interval = config.IntervalSeconds;
            BigInteger currentPeriod = Runtime.Time / interval;

            // Read user stats
            UserCheckinStats stats = GetUserStatsInternal(appId, user);

            bool isNewUser = stats.LastCheckinPeriod == 0;

            if (!isNewUser)
            {
                // Prevent double check-in within same period
                ExecutionEngine.Assert(currentPeriod > stats.LastCheckinPeriod, "already checked in this period");

                // Detect streak break (missed more than one period) -- 14-day reset
                if (currentPeriod > stats.LastCheckinPeriod + 1)
                {
                    // Save highest if current was higher
                    if (stats.CurrentStreak > stats.HighestStreak)
                    {
                        stats.HighestStreak = stats.CurrentStreak;
                    }
                    stats.CurrentStreak = 0;
                }
            }

            // Increment streak
            stats.CurrentStreak += 1;
            stats.TotalCheckins += 1;
            stats.LastCheckinPeriod = currentPeriod;

            // Update highest streak
            if (stats.CurrentStreak > stats.HighestStreak)
            {
                stats.HighestStreak = stats.CurrentStreak;
            }

            // Calculate and accumulate reward
            BigInteger reward = 0;
            if (config.RewardPerCheckin > 0 && stats.CurrentStreak >= config.MinStreakForReward)
            {
                BigInteger pool = GetRewardPoolBalance(appId);
                if (pool >= config.RewardPerCheckin)
                {
                    reward = config.RewardPerCheckin;
                    // Deduct from pool
                    WriteRewardPool(appId, pool - reward);
                    stats.UnclaimedRewards += reward;

                    // Update app total rewarded
                    byte[] rewardedKey = AppStatKey(appId, "rewarded");
                    BigInteger totalRewarded = ReadBigInteger(rewardedKey);
                    Storage.Put(Storage.CurrentContext, rewardedKey, totalRewarded + reward);
                }
            }

            // Persist user stats
            WriteUserStats(appId, user, stats);

            // Update app-wide counters
            byte[] checkinCountKey = AppStatKey(appId, "checkins");
            BigInteger appCheckins = ReadBigInteger(checkinCountKey);
            Storage.Put(Storage.CurrentContext, checkinCountKey, appCheckins + 1);

            if (isNewUser)
            {
                byte[] userCountKey = AppStatKey(appId, "users");
                BigInteger appUsers = ReadBigInteger(userCountKey);
                Storage.Put(Storage.CurrentContext, userCountKey, appUsers + 1);
            }

            BigInteger nextEligible = (currentPeriod + 1) * interval;
            OnCheckedIn(appId, user, stats.CurrentStreak, reward, nextEligible);

            // ScriptEngine hook
            TriggerScriptHook(appId, "onCheckin", user, stats.CurrentStreak);
        }

        // ── Rewards ───────────────────────────────────────────────────────

        public static void FundRewardPool(string appId, UInt160 funder, BigInteger amount)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(funder != UInt160.Zero && funder.IsValid, "invalid funder");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(Runtime.CheckWitness(funder), "unauthorized");

            // Transfer GAS from funder to this contract
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                funder, Runtime.ExecutingScriptHash, amount, appId);
            ExecutionEngine.Assert(transferred, "fund transfer failed");

            BigInteger current = GetRewardPoolBalance(appId);
            BigInteger newBalance = current + amount;
            WriteRewardPool(appId, newBalance);

            OnRewardPoolFunded(appId, funder, amount, newBalance);
        }

        public static void ClaimRewards(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");

            UserCheckinStats stats = GetUserStatsInternal(appId, user);
            ExecutionEngine.Assert(stats.UnclaimedRewards > 0, "no rewards to claim");

            BigInteger claimAmount = stats.UnclaimedRewards;
            stats.UnclaimedRewards = 0;
            stats.TotalClaimed += claimAmount;

            // Transfer GAS to user
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, user, claimAmount, null);
            ExecutionEngine.Assert(transferred, "reward transfer failed");

            WriteUserStats(appId, user, stats);
            OnRewardsClaimed(appId, user, claimAmount, stats.TotalClaimed);
        }

        // ── Safe Queries ──────────────────────────────────────────────────

        [Safe]
        public static AppConfig GetConfig(string appId)
        {
            ValidateAppId(appId);
            return GetConfigInternal(appId);
        }

        [Safe]
        public static UserCheckinStats GetUserStats(string appId, UInt160 user)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            return GetUserStatsInternal(appId, user);
        }

        [Safe]
        public static AppStats GetAppStats(string appId)
        {
            ValidateAppId(appId);
            return new AppStats
            {
                TotalCheckins = ReadBigInteger(AppStatKey(appId, "checkins")),
                TotalUniqueUsers = ReadBigInteger(AppStatKey(appId, "users")),
                TotalRewarded = ReadBigInteger(AppStatKey(appId, "rewarded")),
                RewardPoolBalance = GetRewardPoolBalance(appId)
            };
        }

        // ── Internal Helpers ──────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, key, value);
        }

        // ── Key Builders ──────────────────────────────────────────────────

        private static byte[] AppConfigKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_CONFIG, (ByteString)(appId ?? ""));
        }

        private static byte[] UserStatsKey(string appId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_STATS,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] AppStatKey(string appId, string statName)
        {
            return Helper.Concat(PREFIX_APP_STATS,
                (ByteString)((appId ?? "") + "|" + statName));
        }

        private static byte[] RewardPoolKey(string appId)
        {
            return Helper.Concat(PREFIX_REWARD_POOL, (ByteString)(appId ?? ""));
        }

        // ── Config / Stats Read/Write ─────────────────────────────────────

        private static AppConfig GetConfigInternal(string appId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, AppConfigKey(appId));
            if (raw == null)
            {
                return new AppConfig
                {
                    AppId = "",
                    IntervalSeconds = DEFAULT_INTERVAL_SECONDS,
                    RewardPerCheckin = 0,
                    MinStreakForReward = 0,
                    Active = false,
                    UpdatedAt = 0
                };
            }
            return (AppConfig)StdLib.Deserialize(raw);
        }

        private static UserCheckinStats GetUserStatsInternal(string appId, UInt160 user)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, UserStatsKey(appId, user));
            if (raw == null)
            {
                return new UserCheckinStats
                {
                    CurrentStreak = 0,
                    HighestStreak = 0,
                    TotalCheckins = 0,
                    LastCheckinPeriod = 0,
                    UnclaimedRewards = 0,
                    TotalClaimed = 0
                };
            }
            return (UserCheckinStats)StdLib.Deserialize(raw);
        }

        private static void WriteUserStats(string appId, UInt160 user, UserCheckinStats stats)
        {
            Storage.Put(Storage.CurrentContext, UserStatsKey(appId, user), StdLib.Serialize(stats));
        }

        private static BigInteger GetRewardPoolBalance(string appId)
        {
            return ReadBigInteger(RewardPoolKey(appId));
        }

        private static void WriteRewardPool(string appId, BigInteger balance)
        {
            WriteBigInteger(RewardPoolKey(appId), balance);
        }

        // ── ScriptEngine Hook ─────────────────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, UInt160 user, BigInteger streak)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, user, streak);
            }
            catch
            {
                // Script failure must not block check-in processing
            }
        }
    }
}
