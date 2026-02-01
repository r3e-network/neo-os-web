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
    
    /// <summary>
    /// Event emitted when a memory is buried.
    /// </summary>
    /// <param name="memoryId">Unique memory identifier</param>
    /// <param name="owner">Memory owner's address</param>
    /// <param name="contentHash">SHA256 hash of encrypted content</param>
    /// <param name="memoryType">Type of memory (1-5: Secret, Regret, Wish, etc.)</param>
    /// <summary>Event emitted when memory buried.</summary>
    public delegate void MemoryBuriedHandler(BigInteger memoryId, UInt160 owner, string contentHash, BigInteger memoryType);
    
    /// <summary>
    /// Event emitted when a memory is permanently forgotten/deleted.
    /// </summary>
    /// <param name="memoryId">The memory identifier</param>
    /// <param name="owner">Memory owner's address</param>
    /// <param name="forgetTime">Unix timestamp when forgotten</param>
    /// <summary>Event emitted when memory forgotten.</summary>
    public delegate void MemoryForgottenHandler(BigInteger memoryId, UInt160 owner, BigInteger forgetTime);
    
    /// <summary>
    /// Event emitted when a memory's content hash is updated.
    /// </summary>
    /// <param name="memoryId">The memory identifier</param>
    /// <param name="newHash">New SHA256 content hash</param>
    /// <summary>Event emitted when memory updated.</summary>
    public delegate void MemoryUpdatedHandler(BigInteger memoryId, string newHash);
    
    /// <summary>
    /// Event emitted when an epitaph is added to a memory.
    /// </summary>
    /// <param name="memoryId">The memory identifier</param>
    /// <param name="epitaph">The epitaph text</param>
    /// <summary>Event emitted when epitaph added.</summary>
    public delegate void EpitaphAddedHandler(BigInteger memoryId, string epitaph);
    
    /// <summary>
    /// Event emitted when a public memorial is created.
    /// </summary>
    /// <param name="memorialId">Unique memorial identifier</param>
    /// <param name="creator">Memorial creator's address</param>
    /// <param name="title">Memorial title</param>
    /// <summary>Event emitted when memorial created.</summary>
    public delegate void MemorialCreatedHandler(BigInteger memorialId, UInt160 creator, string title);
    
    /// <summary>
    /// Event emitted when a tribute is added to a memorial.
    /// </summary>
    /// <param name="memorialId">The memorial identifier</param>
    /// <param name="sender">Tribute sender's address</param>
    /// <param name="amount">Tribute amount in GAS</param>
    /// <summary>Event emitted when tribute added.</summary>
    public delegate void TributeAddedHandler(BigInteger memorialId, UInt160 sender, BigInteger amount);
    
    /// <summary>
    /// Event emitted when a user earns a badge.
    /// </summary>
    /// <param name="user">User's address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Badge name</param>
    /// <summary>Event emitted when user badge earned.</summary>
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

    /// <summary>
    /// Digital Graveyard MiniApp - Encrypted data burial and deletion platform.
    /// </summary>
    [DisplayName("MiniAppGraveyard")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Neo R3E Network MiniApp. Graveyard is an encrypted data burial platform.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    /// <summary>
    /// Graveyard MiniApp - Digital memory burial with NeoFS storage support.
    /// 
    /// FEATURES:
    /// - Bury encrypted memories with content hash verification
    /// - NeoFS storage for large memories (photos, videos, documents)
    /// - Create public memorials with media assets
    /// - Epitaphs (on-chain or NeoFS for long content)
    /// - Forget memories (permanent deletion)
    /// 
    /// STORAGE MODES:
    /// - Hash-Only: Store only content hash (user manages storage)
    /// - NeoFS: Store in decentralized NeoFS network (cheaper, permanent)
    /// 
    /// NEOFS BENEFITS:
    /// - 99% cheaper than on-chain storage
    /// - Unlimited content size
    /// - Content-addressed integrity
    /// - Permanent and censorship-resistant
    /// </summary>
    public partial class MiniAppGraveyard : MiniAppNeoFSBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the Graveyard miniapp.</summary>
        /// <summary>Unique application identifier for the graveyard miniapp.</summary>
        private const string APP_ID = "miniapp-graveyard";
        
        /// <summary>Fee to bury a memory (0.1 GAS = 10,000,000).</summary>
        private const long BURY_FEE = 10000000;
        
        /// <summary>Fee to permanently forget a memory (1 GAS = 100,000,000). Higher fee to prevent abuse.</summary>
        private const long FORGET_FEE = 100000000;
        
        /// <summary>Fee to create a public memorial (5 GAS = 500,000,000).</summary>
        private const long MEMORIAL_FEE = 500000000;
        
        /// <summary>Minimum tribute amount for memorials (0.1 GAS = 10,000,000).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_TRIBUTE = 10000000;
        
        /// <summary>Maximum length for on-chain epitaphs (500 characters). Longer content uses NeoFS.</summary>
        private const int MAX_EPITAPH_LENGTH = 500;
        
        /// <summary>Maximum length for memorial titles (100 characters).</summary>
        private const int MAX_TITLE_LENGTH = 100;
        #endregion

        #region App Prefixes (0x20+)
        /// <summary>Storage prefix for memory id.</summary>
        private static readonly byte[] PREFIX_MEMORY_ID = new byte[] { 0x20 };
        /// <summary>Storage prefix for memories.</summary>
        private static readonly byte[] PREFIX_MEMORIES = new byte[] { 0x21 };
        /// <summary>Storage prefix for user memories.</summary>
        private static readonly byte[] PREFIX_USER_MEMORIES = new byte[] { 0x22 };
        /// <summary>Storage prefix for user memory count.</summary>
        private static readonly byte[] PREFIX_USER_MEMORY_COUNT = new byte[] { 0x23 };
        /// <summary>Storage prefix for memorial id.</summary>
        private static readonly byte[] PREFIX_MEMORIAL_ID = new byte[] { 0x24 };
        /// <summary>Storage prefix for memorials.</summary>
        private static readonly byte[] PREFIX_MEMORIALS = new byte[] { 0x25 };
        /// <summary>Storage prefix for total buried.</summary>
        private static readonly byte[] PREFIX_TOTAL_BURIED = new byte[] { 0x26 };
        /// <summary>Storage prefix for total forgotten.</summary>
        private static readonly byte[] PREFIX_TOTAL_FORGOTTEN = new byte[] { 0x27 };
        /// <summary>Storage prefix for total tributes.</summary>
        private static readonly byte[] PREFIX_TOTAL_TRIBUTES = new byte[] { 0x28 };
        /// <summary>Storage prefix for user stats.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x29 };
        /// <summary>Storage prefix for user badges.</summary>
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x2A };
        /// <summary>Storage prefix for total users.</summary>
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2B };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a buried memory with encrypted content reference.
        /// 
        /// Storage: Serialized and stored with PREFIX_MEMORIES + memoryId
        /// Created: When memory is buried
        /// Updated: When epitaph added, content updated, or forgotten
        /// </summary>
        public struct Memory
        {
            /// <summary>Owner's address who buried the memory.</summary>
            public UInt160 Owner;
            /// <summary>SHA256 hash of encrypted content for integrity verification.</summary>
            public string ContentHash;
            /// <summary>Memory type: 1=Secret, 2=Regret, 3=Wish, 4=Message, 5=Other.</summary>
            public BigInteger MemoryType;
            /// <summary>Unix timestamp when memory was buried.</summary>
            public BigInteger BuriedTime;
            /// <summary>Unix timestamp when memory was forgotten (0 if not forgotten).</summary>
            public BigInteger ForgottenTime;
            /// <summary>Optional epitaph text (max 500 chars, or NeoFS reference).</summary>
            public string Epitaph;
            /// <summary>Whether the memory has been permanently forgotten.</summary>
            public bool Forgotten;
        }

        /// <summary>
        /// Public memorial for sharing memories and receiving tributes.
        /// 
        /// Storage: Serialized and stored with PREFIX_MEMORIALS + memorialId
        /// Created: When memorial is created
        /// Updated: When tributes are added
        /// </summary>
        public struct Memorial
        {
            /// <summary>Creator's address.</summary>
            public UInt160 Creator;
            /// <summary>Memorial title (max 100 characters).</summary>
            public string Title;
            /// <summary>Memorial description text.</summary>
            public string Description;
            /// <summary>Unix timestamp when memorial was created.</summary>
            public BigInteger CreatedTime;
            /// <summary>Total amount of tributes received in GAS.</summary>
            public BigInteger TotalTributes;
            /// <summary>Number of tribute transactions received.</summary>
            public BigInteger TributeCount;
            /// <summary>Whether the memorial is active (can be closed by admin).</summary>
            public bool Active;
        }

        /// <summary>
        /// User statistics and achievements tracking.
        /// 
        /// Storage: Serialized and stored with PREFIX_USER_STATS + user address
        /// Updated: After each user action (bury, forget, create memorial, etc.)
        /// </summary>
        public struct UserStats
        {
            /// <summary>Total memories buried by user.</summary>
            public BigInteger MemoriesBuried;
            /// <summary>Total memories permanently forgotten.</summary>
            public BigInteger MemoriesForgotten;
            /// <summary>Number of public memorials created.</summary>
            public BigInteger MemorialsCreated;
            /// <summary>Total tributes sent to memorials in GAS.</summary>
            public BigInteger TributesSent;
            /// <summary>Total tributes received on own memorials in GAS.</summary>
            public BigInteger TributesReceived;
            /// <summary>Total GAS spent on fees and tributes.</summary>
            public BigInteger TotalSpent;
            /// <summary>Number of badges/achievements earned.</summary>
            public BigInteger BadgeCount;
            /// <summary>Unix timestamp of first activity (user join time).</summary>
            public BigInteger JoinTime;
            /// <summary>Unix timestamp of most recent activity.</summary>
            public BigInteger LastActivityTime;
            /// <summary>Count of secrets buried (memory type 1).</summary>
            public BigInteger SecretsBuried;
            /// <summary>Count of regrets buried (memory type 2).</summary>
            public BigInteger RegretsBuried;
            /// <summary>Count of wishes buried (memory type 3).</summary>
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
