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
    public delegate void DeveloperRegisteredHandler(BigInteger devId, UInt160 wallet, string name, string role);
    public delegate void DeveloperUpdatedHandler(BigInteger devId, string field, string newValue);
    public delegate void DeveloperDeactivatedHandler(BigInteger devId, UInt160 wallet);
    public delegate void TipSentHandler(UInt160 tipper, BigInteger devId, BigInteger amount, string message, string tipperName);
    public delegate void TipWithdrawnHandler(BigInteger devId, UInt160 wallet, BigInteger amount);
    public delegate void MilestoneReachedHandler(BigInteger devId, BigInteger milestone, BigInteger totalTips);
    public delegate void TipperBadgeEarnedHandler(UInt160 tipper, BigInteger badgeType, string badgeName);
    public delegate void DevBadgeEarnedHandler(BigInteger devId, BigInteger badgeType, string badgeName);

    [DisplayName("MiniAppDevTipping")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DevTipping is a complete developer support platform.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppDevTipping : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-dev-tipping";
        private const long MIN_TIP = 100000;
        private const long BRONZE_TIP = 10000000;
        private const long SILVER_TIP = 100000000;
        private const long GOLD_TIP = 1000000000;
        private const long MILESTONE_1 = 1000000000;
        private const long MILESTONE_2 = 10000000000;
        private const long MILESTONE_3 = 100000000000;
        private const int MAX_BIO_LENGTH = 500;
        private const int MAX_LINK_LENGTH = 200;
        private const int MAX_MESSAGE_LENGTH = 500;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_DEV_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_DEVELOPERS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_TOTAL_DONATED = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_TIP_ID = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TIPS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TIPPER_STATS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TIPPER_BADGES = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_DEV_BADGES = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_DEV_TIPS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_DEV_TIP_COUNT = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_ACTIVE_DEVS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        public struct DeveloperData
        {
            public UInt160 Wallet;
            public string Name;
            public string Role;
            public string Bio;
            public string Link;
            public BigInteger Balance;
            public BigInteger TotalReceived;
            public BigInteger TipCount;
            public BigInteger TipperCount;
            public BigInteger WithdrawCount;
            public BigInteger TotalWithdrawn;
            public BigInteger RegisterTime;
            public BigInteger LastTipTime;
            public BigInteger BadgeCount;
            public bool Active;
        }

        public struct TipData
        {
            public UInt160 Tipper;
            public BigInteger DevId;
            public BigInteger Amount;
            public string Message;
            public string TipperName;
            public BigInteger Timestamp;
            public BigInteger TipTier;
            public bool Anonymous;
        }

        public struct TipperStats
        {
            public BigInteger TotalTipped;
            public BigInteger TipCount;
            public BigInteger DevsSupported;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastTipTime;
            public BigInteger HighestTip;
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