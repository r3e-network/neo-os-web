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
    // Event delegates for memory lifecycle
    public delegate void MemoryBuriedHandler(BigInteger memoryId, UInt160 owner, string contentHash, BigInteger memoryType);
    public delegate void MemoryForgottenHandler(BigInteger memoryId, UInt160 owner, BigInteger forgetTime);
    public delegate void MemoryUpdatedHandler(BigInteger memoryId, string newHash);
    public delegate void EpitaphAddedHandler(BigInteger memoryId, string epitaph);
    public delegate void MemorialCreatedHandler(BigInteger memorialId, UInt160 creator, string title);
    public delegate void TributeAddedHandler(BigInteger memorialId, UInt160 sender, BigInteger amount);
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

    /// <summary>
    /// Digital Graveyard MiniApp - Encrypted data burial and deletion platform.
    /// </summary>
    [DisplayName("MiniAppGraveyard")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Neo R3E Network MiniApp. Graveyard is an encrypted data burial platform.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppGraveyard : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-graveyard";
        private const long BURY_FEE = 10000000;        // 0.1 GAS
        private const long FORGET_FEE = 100000000;     // 1 GAS
        private const long MEMORIAL_FEE = 500000000;   // 5 GAS
        private const long MIN_TRIBUTE = 10000000;     // 0.1 GAS
        private const int MAX_EPITAPH_LENGTH = 500;
        private const int MAX_TITLE_LENGTH = 100;
        #endregion

        #region App Prefixes (0x20+)
        private static readonly byte[] PREFIX_MEMORY_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_MEMORIES = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_MEMORIES = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_MEMORY_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_MEMORIAL_ID = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_MEMORIALS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_BURIED = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_FORGOTTEN = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_TRIBUTES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2B };
        #endregion

        #region Data Structures
        public struct Memory
        {
            public UInt160 Owner;
            public string ContentHash;
            public BigInteger MemoryType;
            public BigInteger BuriedTime;
            public BigInteger ForgottenTime;
            public string Epitaph;
            public bool Forgotten;
        }

        public struct Memorial
        {
            public UInt160 Creator;
            public string Title;
            public string Description;
            public BigInteger CreatedTime;
            public BigInteger TotalTributes;
            public BigInteger TributeCount;
            public bool Active;
        }

        public struct UserStats
        {
            public BigInteger MemoriesBuried;
            public BigInteger MemoriesForgotten;
            public BigInteger MemorialsCreated;
            public BigInteger TributesSent;
            public BigInteger TributesReceived;
            public BigInteger TotalSpent;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger SecretsBuried;
            public BigInteger RegretsBuried;
            public BigInteger WishesBuried;
        }
        #endregion

        #region Events
        [DisplayName("MemoryBuried")]
        public static event MemoryBuriedHandler OnMemoryBuried;

        [DisplayName("MemoryForgotten")]
        public static event MemoryForgottenHandler OnMemoryForgotten;

        [DisplayName("MemoryUpdated")]
        public static event MemoryUpdatedHandler OnMemoryUpdated;

        [DisplayName("EpitaphAdded")]
        public static event EpitaphAddedHandler OnEpitaphAdded;

        [DisplayName("MemorialCreated")]
        public static event MemorialCreatedHandler OnMemorialCreated;

        [DisplayName("TributeAdded")]
        public static event TributeAddedHandler OnTributeAdded;

        [DisplayName("UserBadgeEarned")]
        public static event UserBadgeEarnedHandler OnUserBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORY_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORIAL_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURIED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FORGOTTEN, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_TRIBUTES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalMemories() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORY_ID);

        [Safe]
        public static BigInteger TotalMemorials() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORIAL_ID);

        [Safe]
        public static BigInteger TotalBuried() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BURIED);

        [Safe]
        public static BigInteger TotalForgotten() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_FORGOTTEN);

        [Safe]
        public static Memory GetMemory(BigInteger memoryId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIES, (ByteString)memoryId.ToByteArray()));
            if (data == null) return new Memory();
            return (Memory)StdLib.Deserialize(data);
        }

        [Safe]
        public static Memorial GetMemorial(BigInteger memorialId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIALS, (ByteString)memorialId.ToByteArray()));
            if (data == null) return new Memorial();
            return (Memorial)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserMemoryCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_MEMORY_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static UserStats GetUserStatsData(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasUserBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
