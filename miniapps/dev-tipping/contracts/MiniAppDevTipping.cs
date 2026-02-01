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
    /// <summary>
    /// Event emitted when a new developer registers on the platform.
    /// </summary>
    /// <param name="devId">Unique developer ID assigned</param>
    /// <param name="wallet">Developer's wallet address</param>
    /// <param name="name">Developer display name</param>
    /// <param name="role">Developer role/specialty</param>
    public delegate void DeveloperRegisteredHandler(BigInteger devId, UInt160 wallet, string name, string role);
    
    /// <summary>
    /// Event emitted when a developer updates their profile.
    /// </summary>
    /// <param name="devId">Developer ID</param>
    /// <param name="field">Field that was updated</param>
    /// <param name="newValue">New value for the field</param>
    public delegate void DeveloperUpdatedHandler(BigInteger devId, string field, string newValue);
    
    /// <summary>
    /// Event emitted when a developer deactivates their account.
    /// </summary>
    /// <param name="devId">Developer ID</param>
    /// <param name="wallet">Developer's wallet address</param>
    public delegate void DeveloperDeactivatedHandler(BigInteger devId, UInt160 wallet);
    
    /// <summary>
    /// Event emitted when a tip is sent to a developer.
    /// </summary>
    /// <param name="tipper">Address of the tipper</param>
    /// <param name="devId">Recipient developer ID</param>
    /// <param name="amount">Tip amount in GAS</param>
    /// <param name="message">Optional message from tipper</param>
    /// <param name="tipperName">Optional name of tipper</param>
    public delegate void TipSentHandler(UInt160 tipper, BigInteger devId, BigInteger amount, string message, string tipperName);
    
    /// <summary>
    /// Event emitted when a developer withdraws their tips.
    /// </summary>
    /// <param name="devId">Developer ID</param>
    /// <param name="wallet">Recipient wallet address</param>
    /// <param name="amount">Withdrawal amount in GAS</param>
    public delegate void TipWithdrawnHandler(BigInteger devId, UInt160 wallet, BigInteger amount);
    
    /// <summary>
    /// Event emitted when a developer reaches a tipping milestone.
    /// </summary>
    /// <param name="devId">Developer ID</param>
    /// <param name="milestone">Milestone number (1, 2, or 3)</param>
    /// <param name="totalTips">Total tips received at milestone</param>
    public delegate void MilestoneReachedHandler(BigInteger devId, BigInteger milestone, BigInteger totalTips);
    
    /// <summary>
    /// Event emitted when a tipper earns a badge.
    /// </summary>
    /// <param name="tipper">Tipper's address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Human-readable badge name</param>
    public delegate void TipperBadgeEarnedHandler(UInt160 tipper, BigInteger badgeType, string badgeName);
    
    /// <summary>
    /// Event emitted when a developer earns a badge.
    /// </summary>
    /// <param name="devId">Developer ID</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Human-readable badge name</param>
    public delegate void DevBadgeEarnedHandler(BigInteger devId, BigInteger badgeType, string badgeName);

    /// <summary>
    /// DevTipping MiniApp - A decentralized platform for supporting developers.
    /// 
    /// Enables users to send tips (in GAS) to registered developers as appreciation
    /// for their work. Features include developer profiles, tipping with messages,
    /// milestone tracking, and a badge system for both tippers and developers.
    /// 
    /// KEY FEATURES:
    /// - Developer registration with profile (name, role, bio, link)
    /// - Send tips with optional messages
    /// - Withdraw tips to wallet
    /// - Milestone system for developers (Bronze, Silver, Gold)
    /// - Badge system for active tippers and popular developers
    /// - Leaderboard and statistics
    /// 
    /// TIP TIERS:
    /// - Bronze: 0.1 GAS or more
    /// - Silver: 1 GAS or more  
    /// - Gold: 10 GAS or more
    /// 
    /// MILESTONES:
    /// - Milestone 1: 1 GAS total received
    /// - Milestone 2: 10 GAS total received
    /// - Milestone 3: 100 GAS total received
    /// 
    /// SECURITY:
    /// - Minimum tip amount enforced (0.001 GAS)
    /// - Only registered developers can receive tips
    /// - Only developers can withdraw their own tips
    /// - Profile updates restricted to owner
    /// 
    /// PERMISSIONS:
    /// - GAS token transfers (0xd2a4cff31913016155e38e474a2c06d08be276cf)
    /// </summary>
    [DisplayName("MiniAppDevTipping")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Decentralized developer tipping and support platform")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppDevTipping : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier.</summary>
        private const string APP_ID = "miniapp-dev-tipping";
        /// <summary>Minimum tip amount in GAS (0.001 GAS = 100,000).</summary>
        private const long MIN_TIP = 100000;
        /// <summary>Bronze tier threshold in GAS (0.1 GAS).</summary>
        private const long BRONZE_TIP = 10000000;
        /// <summary>Silver tier threshold in GAS (1 GAS).</summary>
        private const long SILVER_TIP = 100000000;
        /// <summary>Gold tier threshold in GAS (10 GAS).</summary>
        private const long GOLD_TIP = 1000000000;
        /// <summary>First milestone threshold in GAS (1 GAS).</summary>
        private const long MILESTONE_1 = 1000000000;
        /// <summary>Second milestone threshold in GAS (10 GAS).</summary>
        private const long MILESTONE_2 = 10000000000;
        /// <summary>Third milestone threshold in GAS (100 GAS).</summary>
        private const long MILESTONE_3 = 100000000000;
        /// <summary>Maximum bio length in characters.</summary>
        private const int MAX_BIO_LENGTH = 500;
        /// <summary>Maximum link length in characters.</summary>
        private const int MAX_LINK_LENGTH = 200;
        /// <summary>Maximum tip message length in characters.</summary>
        private const int MAX_MESSAGE_LENGTH = 500;
        #endregion

        #region Storage Prefixes
        /// <summary>Prefix for developer ID counter (0x20).</summary>
        private static readonly byte[] PREFIX_DEV_ID = new byte[] { 0x20 };
        /// <summary>Prefix for developer data storage (0x21).</summary>
        private static readonly byte[] PREFIX_DEVELOPERS = new byte[] { 0x21 };
        /// <summary>Prefix for total donated tracking (0x22).</summary>
        private static readonly byte[] PREFIX_TOTAL_DONATED = new byte[] { 0x22 };
        /// <summary>Prefix for tip ID counter (0x23).</summary>
        private static readonly byte[] PREFIX_TIP_ID = new byte[] { 0x23 };
        /// <summary>Prefix for tip data storage (0x24).</summary>
        private static readonly byte[] PREFIX_TIPS = new byte[] { 0x24 };
        /// <summary>Prefix for tipper statistics (0x25).</summary>
        private static readonly byte[] PREFIX_TIPPER_STATS = new byte[] { 0x25 };
        /// <summary>Prefix for tipper badges (0x26).</summary>
        private static readonly byte[] PREFIX_TIPPER_BADGES = new byte[] { 0x26 };
        /// <summary>Prefix for developer badges (0x27).</summary>
        private static readonly byte[] PREFIX_DEV_BADGES = new byte[] { 0x27 };
        /// <summary>Prefix for developer's tip history (0x28).</summary>
        private static readonly byte[] PREFIX_DEV_TIPS = new byte[] { 0x28 };
        /// <summary>Prefix for developer's tip count (0x29).</summary>
        private static readonly byte[] PREFIX_DEV_TIP_COUNT = new byte[] { 0x29 };
        /// <summary>Prefix for active developers list (0x2A).</summary>
        private static readonly byte[] PREFIX_ACTIVE_DEVS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a registered developer's profile and statistics.
        /// </summary>
        public struct DeveloperData
        {
            /// <summary>Developer wallet address.</summary>
            public UInt160 Wallet;
            /// <summary>Display name.</summary>
            public string Name;
            /// <summary>Role or specialty.</summary>
            public string Role;
            /// <summary>Bio/description.</summary>
            public string Bio;
            /// <summary>External link (GitHub, website, etc.).</summary>
            public string Link;
            /// <summary>Current withdrawable balance in GAS.</summary>
            public BigInteger Balance;
            /// <summary>Total amount received in GAS.</summary>
            public BigInteger TotalReceived;
            /// <summary>Number of tips received.</summary>
            public BigInteger TipCount;
            /// <summary>Number of unique tippers.</summary>
            public BigInteger TipperCount;
            /// <summary>Number of withdrawals made.</summary>
            public BigInteger WithdrawCount;
            /// <summary>Total amount withdrawn in GAS.</summary>
            public BigInteger TotalWithdrawn;
            /// <summary>Registration timestamp.</summary>
            public BigInteger RegisterTime;
            /// <summary>Timestamp of last tip received.</summary>
            public BigInteger LastTipTime;
            /// <summary>Number of badges earned.</summary>
            public BigInteger BadgeCount;
            /// <summary>Whether account is active.</summary>
            public bool Active;
        }

        /// <summary>
        /// Represents a single tip transaction.
        /// </summary>
        public struct TipData
        {
            /// <summary>Tipper's wallet address.</summary>
            public UInt160 Tipper;
            /// <summary>Recipient developer ID.</summary>
            public BigInteger DevId;
            /// <summary>Tip amount in GAS.</summary>
            public BigInteger Amount;
            /// <summary>Optional message from tipper.</summary>
            public string Message;
            /// <summary>Tipper display name (optional).</summary>
            public string TipperName;
            /// <summary>Tip timestamp.</summary>
            public BigInteger Timestamp;
            /// <summary>Tip tier (1=Bronze, 2=Silver, 3=Gold).</summary>
            public BigInteger TipTier;
            /// <summary>Whether tip is anonymous.</summary>
            public bool Anonymous;
        }

        /// <summary>
        /// Statistics for a tipper across all their tips.
        /// </summary>
        public struct TipperStats
        {
            /// <summary>Total amount tipped in GAS.</summary>
            public BigInteger TotalTipped;
            /// <summary>Number of tips sent.</summary>
            public BigInteger TipCount;
            /// <summary>Number of unique developers supported.</summary>
            public BigInteger DevsSupported;
            /// <summary>Number of badges earned.</summary>
            public BigInteger BadgeCount;
            /// <summary>First tip timestamp.</summary>
            public BigInteger JoinTime;
            /// <summary>Last tip timestamp.</summary>
            public BigInteger LastTipTime;
            /// <summary>Largest single tip amount.</summary>
            public BigInteger HighestTip;
            /// <summary>Most tipped developer ID.</summary>
            public BigInteger FavoriteDevId;
        }
        #endregion

        #region Events
        [DisplayName("DeveloperRegistered")]
        public static event DeveloperRegisteredHandler OnDeveloperRegistered;

        [DisplayName("DeveloperUpdated")]
        public static event DeveloperUpdatedHandler OnDeveloperUpdated;

        [DisplayName("DeveloperDeactivated")]
        public static event DeveloperDeactivatedHandler OnDeveloperDeactivated;

        [DisplayName("TipSent")]
        public static event TipSentHandler OnTipSent;

        [DisplayName("TipWithdrawn")]
        public static event TipWithdrawnHandler OnTipWithdrawn;

        [DisplayName("MilestoneReached")]
        public static event MilestoneReachedHandler OnMilestoneReached;

        [DisplayName("TipperBadgeEarned")]
        public static event TipperBadgeEarnedHandler OnTipperBadgeEarned;

        [DisplayName("DevBadgeEarned")]
        public static event DevBadgeEarnedHandler OnDevBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_DEV_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TIP_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DONATED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_DEVS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalDevelopers()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DEV_ID);
        }

        [Safe]
        public static BigInteger ActiveDevelopers()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ACTIVE_DEVS);
        }

        [Safe]
        public static BigInteger TotalDonated()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DONATED);
        }

        [Safe]
        public static BigInteger TotalTips()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TIP_ID);
        }

        [Safe]
        public static DeveloperData GetDeveloper(BigInteger devId)
        {
            byte[] key = Helper.Concat(PREFIX_DEVELOPERS, (ByteString)devId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new DeveloperData();
            return (DeveloperData)StdLib.Deserialize(data);
        }

        [Safe]
        public static TipData GetTip(BigInteger tipId)
        {
            byte[] key = Helper.Concat(PREFIX_TIPS, (ByteString)tipId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new TipData();
            return (TipData)StdLib.Deserialize(data);
        }

        [Safe]
        public static TipperStats GetTipperStats(UInt160 tipper)
        {
            byte[] key = Helper.Concat(PREFIX_TIPPER_STATS, tipper);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new TipperStats();
            return (TipperStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasTipperBadge(UInt160 tipper, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_TIPPER_BADGES, tipper),
                (ByteString)badgeType.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key) != null;
        }

        [Safe]
        public static bool HasDevBadge(BigInteger devId, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_DEV_BADGES, (ByteString)devId.ToByteArray()),
                (ByteString)badgeType.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key) != null;
        }
        #endregion
    }
}