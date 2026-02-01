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
    // Event delegates for capsule lifecycle
    /// <summary>Event emitted when capsule created.</summary>
    public delegate void CapsuleCreatedHandler(BigInteger capsuleId, UInt160 owner, BigInteger amount, BigInteger unlockTime);
    /// <summary>Event emitted when capsule unlocked.</summary>
    public delegate void CapsuleUnlockedHandler(BigInteger capsuleId, UInt160 owner, BigInteger payout);
    /// <summary>Event emitted when compound added.</summary>
    public delegate void CompoundAddedHandler(BigInteger capsuleId, BigInteger yieldAmount, BigInteger totalCompound);
    /// <summary>Event emitted when capsule extended.</summary>
    public delegate void CapsuleExtendedHandler(BigInteger capsuleId, BigInteger newUnlockTime);
    /// <summary>Event emitted when early withdraw.</summary>
    public delegate void EarlyWithdrawHandler(BigInteger capsuleId, UInt160 owner, BigInteger penalty);
    /// <summary>Event emitted when deposit added.</summary>
    public delegate void DepositAddedHandler(BigInteger capsuleId, BigInteger amount, BigInteger newPrincipal);
    /// <summary>Event emitted when user badge earned.</summary>
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
    /// <summary>Event emitted when tier upgraded.</summary>
    public delegate void TierUpgradedHandler(BigInteger capsuleId, BigInteger oldTier, BigInteger newTier);

    /// <summary>
    /// Compound Capsule MiniApp - NEO savings with compound interest.
    /// </summary>
    [DisplayName("MiniAppCompoundCapsule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Neo R3E Network MiniApp. CompoundCapsule is a NEO savings platform with tiered APY.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppCompoundCapsule : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the compound-capsule miniapp.</summary>
        private const string APP_ID = "miniapp-compound-capsule";
        private const int PLATFORM_FEE_BPS = 100;           // 1% platform fee
        private const int EARLY_WITHDRAW_PENALTY_BPS = 500; // 5% early withdrawal penalty
        /// <summary>Minimum value for operation.</summary>
        /// <summary>Configuration constant .</summary>
        private const long MIN_DEPOSIT = 100000000;         // 1 NEO
        private const int MIN_LOCK_DAYS = 7;
        private const int MAX_LOCK_DAYS = 365;

        // APY tiers (in basis points)
        private const int TIER1_DAYS = 7;
        private const int TIER1_APY_BPS = 300;   // 3% APY
        private const int TIER2_DAYS = 30;
        private const int TIER2_APY_BPS = 500;   // 5% APY
        private const int TIER3_DAYS = 90;
        private const int TIER3_APY_BPS = 800;   // 8% APY
        private const int TIER4_DAYS = 180;
        private const int TIER4_APY_BPS = 1200;  // 12% APY
        #endregion

        #region App Prefixes (0x20+)
        /// <summary>Storage prefix for capsule id.</summary>
        private static readonly byte[] PREFIX_CAPSULE_ID = new byte[] { 0x20 };
        /// <summary>Storage prefix for capsules.</summary>
        private static readonly byte[] PREFIX_CAPSULES = new byte[] { 0x21 };
        /// <summary>Storage prefix for user capsules.</summary>
        private static readonly byte[] PREFIX_USER_CAPSULES = new byte[] { 0x22 };
        /// <summary>Storage prefix for user capsule count.</summary>
        private static readonly byte[] PREFIX_USER_CAPSULE_COUNT = new byte[] { 0x23 };
        /// <summary>Storage prefix for total locked.</summary>
        private static readonly byte[] PREFIX_TOTAL_LOCKED = new byte[] { 0x24 };
        /// <summary>Storage prefix for total compound.</summary>
        private static readonly byte[] PREFIX_TOTAL_COMPOUND = new byte[] { 0x25 };
        /// <summary>Storage prefix for user stats.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x26 };
        /// <summary>Storage prefix for user badges.</summary>
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x27 };
        /// <summary>Storage prefix for total users.</summary>
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x28 };
        /// <summary>Storage prefix for total withdrawn.</summary>
        private static readonly byte[] PREFIX_TOTAL_WITHDRAWN = new byte[] { 0x29 };
        /// <summary>Storage prefix for total penalties.</summary>
        private static readonly byte[] PREFIX_TOTAL_PENALTIES = new byte[] { 0x2A };
        /// <summary>Storage prefix for user total earned.</summary>
        private static readonly byte[] PREFIX_USER_TOTAL_EARNED = new byte[] { 0x2B };
        #endregion

        #region Data Structures
        public struct Capsule
        {
            public UInt160 Owner;
            public BigInteger Principal;
            public BigInteger Compound;
            public BigInteger CreatedTime;
            public BigInteger UnlockTime;
            public BigInteger LastCompoundTime;
            public BigInteger LockDays;
            public BigInteger ApyBps;
            public bool Active;
            public bool EarlyWithdrawn;
        }

        public struct UserStats
        {
            public BigInteger TotalCapsules;
            public BigInteger ActiveCapsules;
            public BigInteger TotalDeposited;
            public BigInteger TotalWithdrawn;
            public BigInteger TotalEarned;
            public BigInteger TotalPenalties;
            public BigInteger HighestDeposit;
            public BigInteger LongestLock;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region Events
        [DisplayName("CapsuleCreated")]
        public static event CapsuleCreatedHandler OnCapsuleCreated;

        [DisplayName("CapsuleUnlocked")]
        public static event CapsuleUnlockedHandler OnCapsuleUnlocked;

        [DisplayName("CompoundAdded")]
        public static event CompoundAddedHandler OnCompoundAdded;

        [DisplayName("CapsuleExtended")]
        public static event CapsuleExtendedHandler OnCapsuleExtended;

        [DisplayName("EarlyWithdraw")]
        public static event EarlyWithdrawHandler OnEarlyWithdraw;

        [DisplayName("DepositAdded")]
        public static event DepositAddedHandler OnDepositAdded;

        [DisplayName("UserBadgeEarned")]
        public static event UserBadgeEarnedHandler OnUserBadgeEarned;

        [DisplayName("TierUpgraded")]
        public static event TierUpgradedHandler OnTierUpgraded;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COMPOUND, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_WITHDRAWN, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PENALTIES, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalCapsules() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CAPSULE_ID);

        [Safe]
        public static BigInteger TotalLocked() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOCKED);

        [Safe]
        public static BigInteger TotalCompound() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_COMPOUND);

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static BigInteger TotalWithdrawn() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_WITHDRAWN);

        [Safe]
        public static BigInteger TotalPenalties() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PENALTIES);

        [Safe]
        public static Capsule GetCapsule(BigInteger capsuleId)
        {
            byte[] key = GetCapsuleKey(capsuleId);
            UInt160 owner = GetUInt160(key, CAPSULE_FIELD_OWNER);
            if (owner == UInt160.Zero) return new Capsule();
            return new Capsule
            {
                Owner = owner,
                Principal = GetBigInteger(key, CAPSULE_FIELD_PRINCIPAL),
                Compound = GetBigInteger(key, CAPSULE_FIELD_COMPOUND),
                CreatedTime = GetBigInteger(key, CAPSULE_FIELD_CREATED_TIME),
                UnlockTime = GetBigInteger(key, CAPSULE_FIELD_UNLOCK_TIME),
                LastCompoundTime = GetBigInteger(key, CAPSULE_FIELD_LAST_COMPOUND),
                LockDays = GetBigInteger(key, CAPSULE_FIELD_LOCK_DAYS),
                ApyBps = GetBigInteger(key, CAPSULE_FIELD_APY_BPS),
                Active = GetBool(key, CAPSULE_FIELD_ACTIVE),
                EarlyWithdrawn = GetBool(key, CAPSULE_FIELD_EARLY_WITHDRAWN)
            };
        }

        [Safe]
        public static BigInteger GetUserCapsuleCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CAPSULE_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static UserStats GetUserStatsData(UInt160 user)
        {
            byte[] key = GetUserStatsKey(user);
            return new UserStats
            {
                TotalCapsules = GetBigInteger(key, USER_STATS_FIELD_TOTAL_CAPSULES),
                ActiveCapsules = GetBigInteger(key, USER_STATS_FIELD_ACTIVE_CAPSULES),
                TotalDeposited = GetBigInteger(key, USER_STATS_FIELD_TOTAL_DEPOSITED),
                TotalWithdrawn = GetBigInteger(key, USER_STATS_FIELD_TOTAL_WITHDRAWN),
                TotalEarned = GetBigInteger(key, USER_STATS_FIELD_TOTAL_EARNED),
                TotalPenalties = GetBigInteger(key, USER_STATS_FIELD_TOTAL_PENALTIES),
                HighestDeposit = GetBigInteger(key, USER_STATS_FIELD_HIGHEST_DEPOSIT),
                LongestLock = GetBigInteger(key, USER_STATS_FIELD_LONGEST_LOCK),
                BadgeCount = GetBigInteger(key, USER_STATS_FIELD_BADGE_COUNT),
                JoinTime = GetBigInteger(key, USER_STATS_FIELD_JOIN_TIME),
                LastActivityTime = GetBigInteger(key, USER_STATS_FIELD_LAST_ACTIVITY)
            };
        }

        [Safe]
        public static bool HasUserBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static Map<string, object> GetCapsuleDetails(BigInteger capsuleId)
        {
            Capsule c = GetCapsule(capsuleId);
            Map<string, object> details = new Map<string, object>();
            if (c.Owner == UInt160.Zero) return details;

            details["id"] = capsuleId;
            details["owner"] = c.Owner;
            details["principal"] = c.Principal;
            details["compound"] = c.Compound;
            details["createdTime"] = c.CreatedTime;
            details["unlockTime"] = c.UnlockTime;
            details["lockDays"] = c.LockDays;
            details["apyBps"] = c.ApyBps;
            details["active"] = c.Active;

            if (c.Active)
            {
                BigInteger remaining = c.UnlockTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
                details["canUnlock"] = Runtime.Time >= c.UnlockTime;
            }
            return details;
        }
        #endregion
    }
}
