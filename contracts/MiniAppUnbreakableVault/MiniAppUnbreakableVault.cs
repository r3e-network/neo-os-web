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
    // Event delegates for vault lifecycle
    public delegate void VaultCreatedHandler(BigInteger vaultId, UInt160 creator, BigInteger bounty, BigInteger difficulty);
    public delegate void AttemptMadeHandler(BigInteger vaultId, UInt160 attacker, bool success, BigInteger attemptNumber);
    public delegate void VaultBrokenHandler(BigInteger vaultId, UInt160 winner, BigInteger reward);
    public delegate void BountyIncreasedHandler(BigInteger vaultId, BigInteger amount, BigInteger newTotal);
    public delegate void VaultExpiredHandler(BigInteger vaultId, UInt160 creator, BigInteger refund);
    public delegate void HintRevealedHandler(BigInteger vaultId, BigInteger hintIndex, string hint);
    public delegate void LeaderboardUpdatedHandler(UInt160 hacker, BigInteger totalBroken, BigInteger totalEarned);
    public delegate void HackerBadgeEarnedHandler(UInt160 hacker, BigInteger badgeType, string badgeName);
    public delegate void CreatorBadgeEarnedHandler(UInt160 creator, BigInteger badgeType, string badgeName);

    /// <summary>
    /// UnbreakableVault MiniApp - Complete hacker bounty challenge platform.
    ///
    /// FEATURES:
    /// - Create vaults with GAS bounties and secret hashes
    /// - Multiple difficulty tiers with different rewards
    /// - Attempt fee system that increases bounty pool
    /// - Hint system for progressive reveals
    /// - Vault expiration and refund mechanism
    /// - Hacker leaderboard and statistics
    /// - Achievement system for hackers
    ///
    /// MECHANICS:
    /// - Creator sets bounty and secret hash
    /// - Attackers pay fee to attempt breaking
    /// - Correct secret wins entire bounty pool
    /// - Failed attempts increase the pool
    /// - Hints can be purchased to aid solving
    /// </summary>
    [DisplayName("MiniAppUnbreakableVault")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. UnbreakableVault is a complete hacker bounty challenge platform with difficulty tiers, hint system, leaderboards, and achievement tracking.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppUnbreakableVault : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-unbreakablevault";
        private const long MIN_BOUNTY = 100000000;        // 1 GAS minimum
        private const long ATTEMPT_FEE_EASY = 10000000;   // 0.1 GAS
        private const long ATTEMPT_FEE_MEDIUM = 50000000; // 0.5 GAS
        private const long ATTEMPT_FEE_HARD = 100000000;  // 1 GAS
        private const int HINT_COST_BPS = 500;            // 5% of bounty per hint
        private const int PLATFORM_FEE_BPS = 200;         // 2% platform fee
        private const int DEFAULT_EXPIRY_SECONDS = 2592000; // 30 days
        private const int MAX_HINTS = 3;                  // Maximum hints per vault
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_VAULT_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_VAULTS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_VAULTS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_VAULT_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_HACKER_STATS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_BOUNTIES = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_BROKEN = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_VAULT_HINTS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_CREATOR_STATS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_HACKER_BADGES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_CREATOR_BADGES = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_HACKERS = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_CREATORS = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_TOTAL_ATTEMPTS = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        public struct VaultData
        {
            public UInt160 Creator;
            public BigInteger Bounty;
            public ByteString SecretHash;
            public BigInteger AttemptCount;
            public BigInteger Difficulty;  // 1=Easy, 2=Medium, 3=Hard
            public BigInteger CreatedTime;
            public BigInteger ExpiryTime;
            public BigInteger HintsRevealed;
            public bool Broken;
            public bool Expired;
            public UInt160 Winner;
            public string Title;
            public string Description;
        }

        public struct HackerStats
        {
            public BigInteger VaultsBroken;
            public BigInteger TotalEarned;
            public BigInteger TotalAttempts;
            public BigInteger HighestBounty;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger EasyBroken;
            public BigInteger MediumBroken;
            public BigInteger HardBroken;
        }

        public struct CreatorStats
        {
            public BigInteger VaultsCreated;
            public BigInteger VaultsBroken;
            public BigInteger VaultsExpired;
            public BigInteger TotalBountiesPosted;
            public BigInteger TotalBountiesLost;
            public BigInteger TotalRefunded;
            public BigInteger HighestBounty;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region App Events
        [DisplayName("VaultCreated")]
        public static event VaultCreatedHandler OnVaultCreated;

        [DisplayName("AttemptMade")]
        public static event AttemptMadeHandler OnAttemptMade;

        [DisplayName("VaultBroken")]
        public static event VaultBrokenHandler OnVaultBroken;

        [DisplayName("BountyIncreased")]
        public static event BountyIncreasedHandler OnBountyIncreased;

        [DisplayName("VaultExpired")]
        public static event VaultExpiredHandler OnVaultExpired;

        [DisplayName("HintRevealed")]
        public static event HintRevealedHandler OnHintRevealed;

        [DisplayName("LeaderboardUpdated")]
        public static event LeaderboardUpdatedHandler OnLeaderboardUpdated;

        [DisplayName("HackerBadgeEarned")]
        public static event HackerBadgeEarnedHandler OnHackerBadgeEarned;

        [DisplayName("CreatorBadgeEarned")]
        public static event CreatorBadgeEarnedHandler OnCreatorBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_VAULT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BOUNTIES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BROKEN, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HACKERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CREATORS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ATTEMPTS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalVaults() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_VAULT_ID);

        [Safe]
        public static BigInteger TotalBounties() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BOUNTIES);

        [Safe]
        public static BigInteger TotalBroken() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BROKEN);

        [Safe]
        public static BigInteger TotalHackers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_HACKERS);

        [Safe]
        public static BigInteger TotalCreators() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CREATORS);

        [Safe]
        public static BigInteger TotalAttempts() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ATTEMPTS);

        [Safe]
        public static VaultData GetVault(BigInteger vaultId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_VAULTS, (ByteString)vaultId.ToByteArray()));
            if (data == null) return new VaultData();
            return (VaultData)StdLib.Deserialize(data);
        }

        [Safe]
        public static HackerStats GetHackerStats(UInt160 hacker)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HACKER_STATS, hacker));
            if (data == null) return new HackerStats();
            return (HackerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static CreatorStats GetCreatorStats(UInt160 creator)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CREATOR_STATS, creator));
            if (data == null) return new CreatorStats();
            return (CreatorStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasHackerBadge(UInt160 hacker, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_HACKER_BADGES, hacker),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static bool HasCreatorBadge(UInt160 creator, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_BADGES, creator),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        // Query methods moved to MiniAppUnbreakableVault.Query.cs
        // User methods moved to MiniAppUnbreakableVault.Methods.cs
        // Internal helpers moved to MiniAppUnbreakableVault.Internal.cs
        // Stats methods moved to MiniAppUnbreakableVault.Stats.cs
        // Badge logic moved to MiniAppUnbreakableVault.Badge.cs
    }
}
