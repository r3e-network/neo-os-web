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
    
    /// <summary>
    /// Event emitted when a new trust is created.
    /// </summary>
    /// <param name="trustId">Unique trust identifier</param>
    /// <param name="owner">Trust creator's address</param>
    /// <param name="heir">Designated heir's address</param>
    /// <param name="principal">Initial NEO principal deposited</param>
    public delegate void TrustCreatedHandler(BigInteger trustId, UInt160 owner, UInt160 heir, BigInteger principal);
    
    /// <summary>
    /// Event emitted when trust terms are modified.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="modificationType">Type of modification (e.g., "heir", "heartbeat", "guardian")</param>
    public delegate void TrustModifiedHandler(BigInteger trustId, string modificationType);
    
    /// <summary>
    /// Event emitted when owner records a heartbeat (proof of life).
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="newDeadline">New execution deadline timestamp</param>
    public delegate void HeartbeatRecordedHandler(BigInteger trustId, BigInteger newDeadline);
    
    /// <summary>
    /// Event emitted when owner claims accumulated yield.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="owner">Owner's address</param>
    /// <param name="amount">GAS amount claimed</param>
    public delegate void YieldClaimedHandler(BigInteger trustId, UInt160 owner, BigInteger amount);
    
    /// <summary>
    /// Event emitted when yield accrues to a trust.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="amount">New yield amount in GAS</param>
    /// <param name="total">Total accumulated yield in GAS</param>
    public delegate void YieldAccruedHandler(BigInteger trustId, BigInteger amount, BigInteger total);
    
    /// <summary>
    /// Event emitted when a trust is executed (assets transferred to heir).
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="heir">Heir who received assets</param>
    /// <param name="principal">NEO principal amount transferred</param>
    public delegate void TrustExecutedHandler(BigInteger trustId, UInt160 heir, BigInteger principal);
    
    /// <summary>
    /// Event emitted when a trust is cancelled by owner.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="owner">Owner who cancelled</param>
    /// <param name="refund">NEO amount refunded</param>
    public delegate void TrustCancelledHandler(BigInteger trustId, UInt160 owner, BigInteger refund);
    
    /// <summary>
    /// Event emitted when heir is changed.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="oldHeir">Previous heir address</param>
    /// <param name="newHeir">New heir address</param>
    public delegate void HeirChangedHandler(BigInteger trustId, UInt160 oldHeir, UInt160 newHeir);
    
    /// <summary>
    /// Event emitted when additional principal is added to trust.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="amount">Additional NEO amount</param>
    /// <param name="newTotal">New total principal</param>
    public delegate void PrincipalAddedHandler(BigInteger trustId, BigInteger amount, BigInteger newTotal);
    
    /// <summary>
    /// Event emitted when a guardian is added to trust.
    /// </summary>
    /// <param name="trustId">The trust identifier</param>
    /// <param name="guardian">Guardian's address</param>
    public delegate void GuardianAddedHandler(BigInteger trustId, UInt160 guardian);
    
    /// <summary>
    /// Event emitted when an owner earns a badge/achievement.
    /// </summary>
    /// <param name="owner">Owner's address</param>
    /// <param name="badgeType">Badge identifier</param>
    /// <param name="badgeName">Badge name</param>
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
    [ManifestExtra("Description", "HeritageTrust locks NEO/GAS, converts NEO to bNEO for GAS rewards, and releases NEO + GAS, NEO + rewards, or rewards-only monthly after inactivity.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppHeritageTrust : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the HeritageTrust miniapp.</summary>
        private const string APP_ID = "miniapp-heritage-trust";
        
        /// <summary>Default heartbeat interval in seconds (30 days = 2,592,000). Owner must check in within this period.</summary>
        private const int HEARTBEAT_INTERVAL_SECONDS = 2592000;
        
        /// <summary>Minimum allowed heartbeat interval in seconds (7 days = 604,800).</summary>
        private const int MIN_HEARTBEAT_SECONDS = 604800;
        
        /// <summary>Maximum allowed heartbeat interval in seconds (365 days = 31,536,000).</summary>
        private const int MAX_HEARTBEAT_SECONDS = 31536000;
        
        /// <summary>Minimum NEO principal required (1 NEO = 100,000,000).</summary>
        private const long MIN_PRINCIPAL = 100000000;
        
        /// <summary>Platform fee in basis points (1% = 100 bps). Only charged on trust execution.</summary>
        private const int PLATFORM_FEE_BPS = 100;
        
        /// <summary>Early cancellation penalty in basis points (5% = 500 bps). Applied if cancelled before first milestone.</summary>
        private const int CANCEL_PENALTY_BPS = 500;
        
        /// <summary>Grace period after deadline in seconds (7 days = 604,800). Allows late heartbeat without immediate execution.</summary>
        private const int GRACE_PERIOD_SECONDS = 604800;
        
        /// <summary>Neo N3 Mainnet network magic number.</summary>
        private const uint NETWORK_MAGIC_MAINNET = 860833102;
        
        /// <summary>Neo N3 Testnet network magic number.</summary>
        private const uint NETWORK_MAGIC_TESTNET = 894710606;

        /// <summary>bNEO contract script hash on Testnet (for converting NEO to bNEO).</summary>
        private static readonly UInt160 DEFAULT_BNEO_SCRIPT_HASH_TESTNET = (UInt160)new byte[]
        {
            0x2c, 0x56, 0x72, 0x5c, 0xd2, 0x60, 0x65, 0xb4, 0xb9, 0x0a,
            0xb4, 0xca, 0x44, 0xbc, 0xd5, 0x54, 0x68, 0x3d, 0x3b, 0x83
        };

        /// <summary>bNEO contract script hash on Mainnet (for converting NEO to bNEO).</summary>
        private static readonly UInt160 DEFAULT_BNEO_SCRIPT_HASH_MAINNET = (UInt160)new byte[]
        {
            0x2a, 0x4c, 0x9a, 0x4d, 0x04, 0x22, 0x67, 0x8b, 0x03, 0xef,
            0x1b, 0xbe, 0x08, 0x34, 0xf9, 0x66, 0x46, 0x0d, 0xc4, 0x48
        };
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
        private static readonly byte[] PREFIX_TOTAL_NEO_PRINCIPAL = new byte[] { 0x2E };
        private static readonly byte[] PREFIX_REWARD_PER_NEO = new byte[] { 0x2F };
        private static readonly byte[] PREFIX_REWARD_DEBT = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_BNEO_CONTRACT = new byte[] { 0x31 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a living trust for estate planning with heartbeat-based inheritance.
        /// 
        /// Storage: Serialized and stored with PREFIX_TRUSTS + trustId
        /// Lifecycle: Created → Active (heartbeat required) → Executed/Cancelled
        /// </summary>
        public struct Trust
        {
            /// <summary>Trust creator and owner address.</summary>
            public UInt160 Owner;
            /// <summary>Primary heir who inherits upon execution.</summary>
            public UInt160 PrimaryHeir;
            /// <summary>NEO principal amount locked in trust.</summary>
            public BigInteger Principal;
            /// <summary>GAS principal amount locked in trust (optional).</summary>
            public BigInteger GasPrincipal;
            /// <summary>Accumulated GAS yield from bNEO staking.</summary>
            public BigInteger AccruedYield;
            /// <summary>GAS yield already claimed by owner.</summary>
            public BigInteger ClaimedYield;
            /// <summary>Monthly NEO release amount after execution triggered.</summary>
            public BigInteger MonthlyNeoRelease;
            /// <summary>Monthly GAS release amount after execution triggered.</summary>
            public BigInteger MonthlyGasRelease;
            /// <summary>If true, only release GAS rewards, keep NEO principal locked.</summary>
            public bool OnlyReleaseRewards;
            /// <summary>Unix timestamp of last beneficiary release claim.</summary>
            public BigInteger LastReleaseTime;
            /// <summary>Total NEO released to beneficiary.</summary>
            public BigInteger TotalNeoReleased;
            /// <summary>Total GAS released to beneficiary.</summary>
            public BigInteger TotalGasReleased;
            /// <summary>Unix timestamp when trust was created.</summary>
            public BigInteger CreatedTime;
            /// <summary>Unix timestamp of last owner heartbeat.</summary>
            public BigInteger LastHeartbeat;
            /// <summary>Heartbeat interval in seconds (owner must check in within this period).</summary>
            public BigInteger HeartbeatInterval;
            /// <summary>Unix timestamp deadline for next heartbeat.</summary>
            public BigInteger Deadline;
            /// <summary>Whether trust is currently active.</summary>
            public bool Active;
            /// <summary>Whether trust has been executed (assets transferred).</summary>
            public bool Executed;
            /// <summary>Whether trust was cancelled by owner.</summary>
            public bool Cancelled;
            /// <summary>Human-readable trust name.</summary>
            public string TrustName;
            /// <summary>Additional notes or instructions.</summary>
            public string Notes;
        }

        /// <summary>
        /// Owner statistics and activity tracking across all trusts.
        /// 
        /// Storage: Serialized and stored with PREFIX_OWNER_STATS + owner address
        /// </summary>
        public struct OwnerStats
        {
            /// <summary>Total number of trusts created.</summary>
            public BigInteger TrustsCreated;
            /// <summary>Number of currently active trusts.</summary>
            public BigInteger ActiveTrusts;
            /// <summary>Total NEO principal deposited across all trusts.</summary>
            public BigInteger TotalPrincipalDeposited;
            /// <summary>Total GAS yield claimed across all trusts.</summary>
            public BigInteger TotalYieldClaimed;
            /// <summary>Number of trusts that have been executed.</summary>
            public BigInteger TrustsExecuted;
            /// <summary>Number of trusts cancelled by owner.</summary>
            public BigInteger TrustsCancelled;
            /// <summary>Number of guardians added across all trusts.</summary>
            public BigInteger GuardiansAdded;
            /// <summary>Total heartbeat check-ins recorded.</summary>
            public BigInteger HeartbeatCount;
            /// <summary>Number of badges/achievements earned.</summary>
            public BigInteger BadgeCount;
            /// <summary>Unix timestamp of first trust creation.</summary>
            public BigInteger JoinTime;
            /// <summary>Unix timestamp of most recent activity.</summary>
            public BigInteger LastActivityTime;
            /// <summary>Largest single trust principal amount.</summary>
            public BigInteger HighestPrincipal;
            /// <summary>Number of times principal was added to existing trusts.</summary>
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
        public static BigInteger TotalNeoPrincipal() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_NEO_PRINCIPAL);

        [Safe]
        public static BigInteger GetRewardPerNeo() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REWARD_PER_NEO);

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
