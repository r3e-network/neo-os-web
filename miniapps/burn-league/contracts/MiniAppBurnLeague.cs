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
    // Event delegates for burn league lifecycle
    /// <summary>Event emitted when gas burned.</summary>
    public delegate void GasBurnedHandler(UInt160 burner, BigInteger amount, BigInteger seasonId);
    /// <summary>Event emitted when reward claimed.</summary>
    public delegate void RewardClaimedHandler(UInt160 claimer, BigInteger reward, BigInteger seasonId);
    /// <summary>Event emitted when season started.</summary>
    public delegate void SeasonStartedHandler(BigInteger seasonId, BigInteger startTime, BigInteger endTime);
    /// <summary>Event emitted when season ended.</summary>
    public delegate void SeasonEndedHandler(BigInteger seasonId, UInt160 winner, BigInteger totalBurned);
    /// <summary>Event emitted when achievement unlocked.</summary>
    public delegate void AchievementUnlockedHandler(UInt160 user, BigInteger achievementId, string name);
    /// <summary>Event emitted when leaderboard updated.</summary>
    public delegate void LeaderboardUpdatedHandler(BigInteger seasonId, UInt160 user, BigInteger rank);
    /// <summary>Event emitted when streak bonus.</summary>
    public delegate void StreakBonusHandler(UInt160 user, BigInteger streakDays, BigInteger bonusMultiplier);
    /// <summary>Event emitted when burner badge earned.</summary>
    public delegate void BurnerBadgeEarnedHandler(UInt160 burner, BigInteger badgeType, string badgeName);

    /// <summary>
    /// BurnLeague MiniApp - Complete competitive GAS burning platform.
    ///
    /// FEATURES:
    /// - Seasonal competitions with leaderboards
    /// - Multiple burn tiers with multipliers
    /// - Achievement system with badges
    /// - Daily streak bonuses
    /// - Team competitions
    /// - Historical statistics tracking
    /// - Automated season management
    ///
    /// MECHANICS:
    /// - Burn GAS to earn points and climb leaderboard
    /// - Higher burns = higher tier multipliers
    /// - Daily burns maintain streak for bonus points
    /// - Top burners share season reward pool
    /// - Achievements unlock permanent bonuses
    /// </summary>
    [DisplayName("MiniAppBurnLeague")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. BurnLeague is a competitive GAS burning platform with seasons, leaderboards, achievements, and team competitions. Burn GAS to earn points, climb rankings, and share in seasonal reward pools.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppBurnLeague : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the burn-league miniapp.</summary>
        private const string APP_ID = "miniapp-burn-league";
        /// <summary>Minimum value for operation.</summary>
        /// <summary>Configuration constant .</summary>
        private const long MIN_BURN = 10000000;           // 0.1 GAS minimum
        private const long TIER1_THRESHOLD = 100000000;   // 1 GAS - 1x multiplier
        private const long TIER2_THRESHOLD = 1000000000;  // 10 GAS - 1.5x multiplier
        private const long TIER3_THRESHOLD = 10000000000; // 100 GAS - 2x multiplier
        private const int SEASON_DURATION_SECONDS = 2592000; // 30 days
        private const int STREAK_WINDOW_SECONDS = 86400;    // 24 hours
        private const int TOP_BURNERS_COUNT = 10;         // Top 10 share rewards
        private const int PLATFORM_FEE_BPS = 500;         // 5% platform fee
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Storage prefix for season id.</summary>
        private static readonly byte[] PREFIX_SEASON_ID = new byte[] { 0x20 };
        /// <summary>Storage prefix for seasons.</summary>
        private static readonly byte[] PREFIX_SEASONS = new byte[] { 0x21 };
        /// <summary>Storage prefix for user season burns.</summary>
        private static readonly byte[] PREFIX_USER_SEASON_BURNS = new byte[] { 0x22 };
        /// <summary>Storage prefix for user total burns.</summary>
        private static readonly byte[] PREFIX_USER_TOTAL_BURNS = new byte[] { 0x23 };
        /// <summary>Storage prefix for user points.</summary>
        private static readonly byte[] PREFIX_USER_POINTS = new byte[] { 0x24 };
        /// <summary>Storage prefix for total burned.</summary>
        private static readonly byte[] PREFIX_TOTAL_BURNED = new byte[] { 0x25 };
        /// <summary>Storage prefix for reward pool.</summary>
        private static readonly byte[] PREFIX_REWARD_POOL = new byte[] { 0x26 };
        /// <summary>Storage prefix for user streak.</summary>
        private static readonly byte[] PREFIX_USER_STREAK = new byte[] { 0x27 };
        /// <summary>Storage prefix for user last burn.</summary>
        private static readonly byte[] PREFIX_USER_LAST_BURN = new byte[] { 0x28 };
        /// <summary>Storage prefix for achievements.</summary>
        private static readonly byte[] PREFIX_ACHIEVEMENTS = new byte[] { 0x29 };
        /// <summary>Storage prefix for user achievements.</summary>
        private static readonly byte[] PREFIX_USER_ACHIEVEMENTS = new byte[] { 0x2A };
        /// <summary>Storage prefix for leaderboard.</summary>
        private static readonly byte[] PREFIX_LEADERBOARD = new byte[] { 0x2B };
        /// <summary>Storage prefix for user rank.</summary>
        private static readonly byte[] PREFIX_USER_RANK = new byte[] { 0x2C };
        /// <summary>Storage prefix for total participants.</summary>
        private static readonly byte[] PREFIX_TOTAL_PARTICIPANTS = new byte[] { 0x2D };
        /// <summary>Storage prefix for user rewards claimed.</summary>
        private static readonly byte[] PREFIX_USER_REWARDS_CLAIMED = new byte[] { 0x2E };
        /// <summary>Storage prefix for burner stats.</summary>
        private static readonly byte[] PREFIX_BURNER_STATS = new byte[] { 0x2F };
        /// <summary>Storage prefix for burner badges.</summary>
        private static readonly byte[] PREFIX_BURNER_BADGES = new byte[] { 0x30 };
        /// <summary>Storage prefix for total burners.</summary>
        private static readonly byte[] PREFIX_TOTAL_BURNERS = new byte[] { 0x31 };
        #endregion

        #region Data Structures
        public struct Season
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger TotalBurned;
            public BigInteger TotalParticipants;
            public BigInteger RewardPool;
            public bool Active;
            public bool Finalized;
            public UInt160 Winner;
        }

        public struct UserSeasonData
        {
            public BigInteger Burned;
            public BigInteger Points;
            public BigInteger Rank;
            public BigInteger RewardsClaimed;
            public BigInteger BurnCount;
            public BigInteger HighestSingleBurn;
        }

        public struct UserStreak
        {
            public BigInteger CurrentStreak;
            public BigInteger LongestStreak;
            public BigInteger LastBurnTime;
        }

        public struct Achievement
        {
            public BigInteger Id;
            public string Name;
            public string Description;
            public BigInteger Requirement;
            public BigInteger BonusPoints;
        }

        public struct BurnerStats
        {
            public BigInteger TotalBurned;
            public BigInteger TotalPoints;
            public BigInteger SeasonsParticipated;
            public BigInteger TotalRewardsClaimed;
            public BigInteger HighestSingleBurn;
            public BigInteger BurnCount;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger LongestStreak;
            public BigInteger CurrentStreak;
            public BigInteger Tier3Burns;
        }
        #endregion

        #region App Events
        [DisplayName("GasBurned")]
        public static event GasBurnedHandler OnGasBurned;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        [DisplayName("SeasonStarted")]
        public static event SeasonStartedHandler OnSeasonStarted;

        [DisplayName("SeasonEnded")]
        public static event SeasonEndedHandler OnSeasonEnded;

        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;

        [DisplayName("LeaderboardUpdated")]
        public static event LeaderboardUpdatedHandler OnLeaderboardUpdated;

        [DisplayName("StreakBonus")]
        public static event StreakBonusHandler OnStreakBonus;

        [DisplayName("BurnerBadgeEarned")]
        public static event BurnerBadgeEarnedHandler OnBurnerBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PARTICIPANTS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger CurrentSeasonId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SEASON_ID);

        [Safe]
        public static BigInteger TotalBurned() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BURNED);

        [Safe]
        public static BigInteger RewardPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REWARD_POOL);

        [Safe]
        public static BigInteger TotalParticipants() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PARTICIPANTS);

        [Safe]
        public static Season GetSeason(BigInteger seasonId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()));
            if (data == null) return new Season();
            return (Season)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserTotalBurned(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_TOTAL_BURNS, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserSeasonPoints(UInt160 user, BigInteger seasonId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_POINTS, user),
                (ByteString)seasonId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static UserStreak GetUserStreak(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STREAK, user));
            if (data == null) return new UserStreak();
            return (UserStreak)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger TotalBurners() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BURNERS);

        [Safe]
        public static BurnerStats GetBurnerStats(UInt160 burner)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BURNER_STATS, burner));
            if (data == null) return new BurnerStats();
            return (BurnerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasBurnerBadge(UInt160 burner, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BURNER_BADGES, burner),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
