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
    // Event delegates for trust lifecycle
    public delegate void TrustCreatedHandler(BigInteger trustId, UInt160 owner, UInt160 heir, BigInteger principal);
    public delegate void TrustModifiedHandler(BigInteger trustId, string modificationType);
    public delegate void HeartbeatRecordedHandler(BigInteger trustId, BigInteger newDeadline);
    public delegate void YieldClaimedHandler(BigInteger trustId, UInt160 owner, BigInteger amount);
    public delegate void YieldAccruedHandler(BigInteger trustId, BigInteger amount, BigInteger total);
    public delegate void TrustExecutedHandler(BigInteger trustId, UInt160 heir, BigInteger principal);
    public delegate void TrustCancelledHandler(BigInteger trustId, UInt160 owner, BigInteger refund);
    public delegate void HeirChangedHandler(BigInteger trustId, UInt160 oldHeir, UInt160 newHeir);
    public delegate void PrincipalAddedHandler(BigInteger trustId, BigInteger amount, BigInteger newTotal);
    public delegate void GuardianAddedHandler(BigInteger trustId, UInt160 guardian);
    public delegate void OwnerBadgeEarnedHandler(UInt160 owner, BigInteger badgeType, string badgeName);

    /// <summary>
    /// HeritageTrust MiniApp - Complete living trust protocol for estate planning.
    ///
    /// FEATURES:
    /// - Create living trusts with NEO deposits
    /// - Heartbeat mechanism for proof-of-life
    /// - Multiple heirs with percentage splits
    /// - Guardian system for trust oversight
    /// - Yield accumulation and claiming
    /// - Trust modification and cancellation
    /// - Comprehensive statistics tracking
    ///
    /// MECHANICS:
    /// - Deposit NEO as principal, earn GAS yields
    /// - Regular heartbeat resets inheritance timer
    /// - On timeout (presumed death), assets transfer to heirs
    /// - Guardians can verify and execute trusts
    /// - Platform fee on execution only
    /// </summary>
    [DisplayName("MiniAppHeritageTrust")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. HeritageTrust is a complete living trust protocol for estate planning with heartbeat mechanism, multiple heirs, guardian oversight, and automated inheritance execution.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppHeritageTrust : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-heritage-trust";
        private const int HEARTBEAT_INTERVAL_SECONDS = 2592000;  // 30 days
        private const int MIN_HEARTBEAT_SECONDS = 604800;        // 7 days minimum
        private const int MAX_HEARTBEAT_SECONDS = 31536000;      // 365 days maximum
        private const long MIN_PRINCIPAL = 100000000;         // 1 NEO minimum
        private const int PLATFORM_FEE_BPS = 100;             // 1% execution fee
        private const int CANCEL_PENALTY_BPS = 500;           // 5% early cancel penalty
        private const int GRACE_PERIOD_SECONDS = 604800;        // 7 days grace after deadline
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_TRUST_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TRUSTS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_TRUSTS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_TRUST_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_HEIR_TRUSTS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_GUARDIANS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_PRINCIPAL = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_YIELD = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_EXECUTED = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_OWNER_STATS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_OWNER_BADGES = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_OWNERS = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_CANCELLED = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_HEIR_TRUST_COUNT = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        public struct Trust
        {
            public UInt160 Owner;
            public UInt160 PrimaryHeir;
            public BigInteger Principal;
            public BigInteger AccruedYield;
            public BigInteger ClaimedYield;
            public BigInteger CreatedTime;
            public BigInteger LastHeartbeat;
            public BigInteger HeartbeatInterval;
            public BigInteger Deadline;
            public bool Active;
            public bool Executed;
            public bool Cancelled;
            public string TrustName;
            public string Notes;
        }

        public struct OwnerStats
        {
            public BigInteger TrustsCreated;
            public BigInteger ActiveTrusts;
            public BigInteger TotalPrincipalDeposited;
            public BigInteger TotalYieldClaimed;
            public BigInteger TrustsExecuted;
            public BigInteger TrustsCancelled;
            public BigInteger GuardiansAdded;
            public BigInteger HeartbeatCount;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger HighestPrincipal;
            public BigInteger PrincipalAdditions;
        }
        #endregion

        #region App Events
        [DisplayName("TrustCreated")]
        public static event TrustCreatedHandler OnTrustCreated;

        [DisplayName("TrustModified")]
        public static event TrustModifiedHandler OnTrustModified;

        [DisplayName("HeartbeatRecorded")]
        public static event HeartbeatRecordedHandler OnHeartbeatRecorded;

        [DisplayName("YieldClaimed")]
        public static event YieldClaimedHandler OnYieldClaimed;

        [DisplayName("YieldAccrued")]
        public static event YieldAccruedHandler OnYieldAccrued;

        [DisplayName("TrustExecuted")]
        public static event TrustExecutedHandler OnTrustExecuted;

        [DisplayName("TrustCancelled")]
        public static event TrustCancelledHandler OnTrustCancelled;

        [DisplayName("HeirChanged")]
        public static event HeirChangedHandler OnHeirChanged;

        [DisplayName("PrincipalAdded")]
        public static event PrincipalAddedHandler OnPrincipalAdded;

        [DisplayName("GuardianAdded")]
        public static event GuardianAddedHandler OnGuardianAdded;

        [DisplayName("OwnerBadgeEarned")]
        public static event OwnerBadgeEarnedHandler OnOwnerBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TRUST_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PRINCIPAL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_YIELD, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_EXECUTED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_OWNERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CANCELLED, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalTrusts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TRUST_ID);

        [Safe]
        public static BigInteger TotalPrincipal() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PRINCIPAL);

        [Safe]
        public static BigInteger TotalYieldDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_YIELD);

        [Safe]
        public static BigInteger TotalExecuted() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_EXECUTED);

        [Safe]
        public static BigInteger TotalOwners() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_OWNERS);

        [Safe]
        public static BigInteger TotalCancelled() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CANCELLED);

        [Safe]
        public static OwnerStats GetOwnerStats(UInt160 owner)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_OWNER_STATS, owner));
            if (data == null) return new OwnerStats();
            return (OwnerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasOwnerBadge(UInt160 owner, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_OWNER_BADGES, owner),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static Trust GetTrust(BigInteger trustId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TRUSTS, (ByteString)trustId.ToByteArray()));
            if (data == null) return new Trust();
            return (Trust)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserTrustCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_TRUST_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsGuardian(BigInteger trustId, UInt160 guardian)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_GUARDIANS, (ByteString)trustId.ToByteArray()),
                guardian);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
