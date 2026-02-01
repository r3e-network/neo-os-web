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
    /// Event emitted when a vote is recorded.
    /// </summary>
    /// <param name="voter">Voter's address</param>
    /// <param name="category">Voting category</param>
    /// <param name="nominee">Nominee name</param>
    /// <param name="amount">Vote amount in GAS</param>
    /// <param name="seasonId">Current season ID</param>
    public delegate void VoteRecordedHandler(UInt160 voter, string category, string nominee, BigInteger amount, BigInteger seasonId);
    
    /// <summary>
    /// Event emitted when a nominee is added.
    /// </summary>
    /// <param name="category">Nominee category</param>
    /// <param name="nominee">Nominee name</param>
    /// <param name="addedBy">Address that added the nominee</param>
    /// <param name="description">Nominee description</param>
    public delegate void NomineeAddedHandler(string category, string nominee, UInt160 addedBy, string description);
    
    /// <summary>
    /// Event emitted when a new season starts.
    /// </summary>
    /// <param name="seasonId">New season ID</param>
    /// <param name="startTime">Season start timestamp</param>
    /// <param name="endTime">Season end timestamp</param>
    public delegate void SeasonStartedHandler(BigInteger seasonId, BigInteger startTime, BigInteger endTime);
    
    /// <summary>
    /// Event emitted when a season ends.
    /// </summary>
    /// <param name="seasonId">Season ID</param>
    /// <param name="category">Winning category</param>
    /// <param name="winner">Winner name</param>
    /// <param name="totalVotes">Total votes cast</param>
    public delegate void SeasonEndedHandler(BigInteger seasonId, string category, string winner, BigInteger totalVotes);
    
    /// <summary>
    /// Event emitted when a nominee is inducted into Hall of Fame.
    /// </summary>
    /// <param name="category">Induction category</param>
    /// <param name="nominee">Inductee name</param>
    /// <param name="totalVotes">Total votes received</param>
    /// <param name="seasonId">Season ID</param>
    public delegate void InductionHandler(string category, string nominee, BigInteger totalVotes, BigInteger seasonId);
    
    /// <summary>
    /// Event emitted when a voter claims rewards.
    /// </summary>
    /// <param name="voter">Voter address</param>
    /// <param name="seasonId">Season ID</param>
    /// <param name="reward">Reward amount in GAS</param>
    public delegate void RewardClaimedHandler(UInt160 voter, BigInteger seasonId, BigInteger reward);
    
    /// <summary>
    /// Event emitted when a voter earns a badge.
    /// </summary>
    /// <param name="voter">Voter address</param>
    /// <param name="badgeType">Badge type identifier</param>
    /// <param name="badgeName">Badge name</param>
    public delegate void VoterBadgeEarnedHandler(UInt160 voter, BigInteger badgeType, string badgeName);

    /// <summary>
    /// Hall of Fame MiniApp - A decentralized voting and recognition platform.
    /// 
    /// Community-driven Hall of Fame with seasonal voting cycles. Users vote for
    /// nominees across different categories using GAS. Winners are inducted into
    /// the Hall of Fame permanently.
    /// 
    /// KEY FEATURES:
    /// - Seasonal voting cycles (30 days each)
    /// - Multiple award categories
    /// - Nominee submission by community
    /// - Transparent on-chain voting
    /// - Voter rewards for participation
    /// - Badge system for active voters
    /// - Hall of Fame inductee registry
    /// 
    /// VOTING MECHANICS:
    /// - Minimum vote: 0.1 GAS
    /// - Platform fee: 5% of vote amount
    /// - Voter rewards: 10% of season pool distributed to voters
    /// - Winner: Highest total votes in category
    /// 
    /// SEASON CYCLE:
    /// - 30 days per season
    /// - Voting open during active season
    /// - Winners announced at season end
    /// - New season starts automatically
    /// 
    /// SECURITY:
    /// - One vote per category per voter per season
    /// - Minimum vote amount enforced
    /// - Only contract owner can start/end seasons
    /// - Inductees permanently recorded
    /// 
    /// PERMISSIONS:
    /// - GAS token transfers (0xd2a4cff31913016155e38e474a2c06d08be276cf)
    /// </summary>
    [DisplayName("MiniAppHallOfFame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Hall of Fame voting and recognition platform with seasonal cycles")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    public partial class MiniAppHallOfFame : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique app identifier for the Hall of Fame platform.</summary>
        private const string APP_ID = "miniapp-hall-of-fame";
        
        /// <summary>Maximum length for category names (50 characters).</summary>
        private const int MAX_CATEGORY_LENGTH = 50;
        
        /// <summary>Maximum length for nominee names (100 characters).</summary>
        private const int MAX_NOMINEE_LENGTH = 100;
        
        /// <summary>Maximum length for nominee descriptions (500 characters).</summary>
        private const int MAX_DESCRIPTION_LENGTH = 500;
        
        /// <summary>Minimum vote amount: 0.1 GAS (10,000,000 neo-atomic units).</summary>
        private const long MIN_VOTE = 10000000;
        
        /// <summary>Duration of each voting season in seconds: 30 days (2,592,000 seconds).</summary>
        private const int SEASON_DURATION_SECONDS = 2592000;
        
        /// <summary>Platform fee in basis points: 500 = 5%.</summary>
        private const int PLATFORM_FEE_BPS = 500;
        
        /// <summary>Voter reward percentage in basis points: 1000 = 10%.</summary>
        private const int VOTER_REWARD_BPS = 1000;
        #endregion

        #region Storage Prefixes (0x20-0x2D)
        // STORAGE LAYOUT:
        // 0x20-0x2D: Hall of Fame app data
        // Collision check: social-karma uses 0x20-0x2C, hall-of-fame uses 0x20-0x2D
        // Note: Overlaps with social-karma, ensure different apps don't deploy together
        
        /// <summary>Prefix 0x20: Category definitions storage.</summary>
        private static readonly byte[] PREFIX_CATEGORY = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Nominee records storage.</summary>
        private static readonly byte[] PREFIX_NOMINEES = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Vote totals per nominee storage.</summary>
        private static readonly byte[] PREFIX_VOTE_TOTAL = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: User votes per season storage.</summary>
        private static readonly byte[] PREFIX_USER_VOTES = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Total pool per season storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_POOL = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Current season ID storage.</summary>
        private static readonly byte[] PREFIX_SEASON_ID = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Season data storage.</summary>
        private static readonly byte[] PREFIX_SEASONS = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Inducted members storage.</summary>
        private static readonly byte[] PREFIX_INDUCTED = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: User voting statistics storage.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x28 };
        
        /// <summary>Prefix 0x29: Season vote records storage.</summary>
        private static readonly byte[] PREFIX_SEASON_VOTES = new byte[] { 0x29 };
        
        /// <summary>Prefix 0x2A: Voter badges storage.</summary>
        private static readonly byte[] PREFIX_VOTER_BADGES = new byte[] { 0x2A };
        
        /// <summary>Prefix 0x2B: Total voter count storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_VOTERS = new byte[] { 0x2B };
        
        /// <summary>Prefix 0x2C: Total nominee count storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_NOMINEES = new byte[] { 0x2C };
        
        /// <summary>Prefix 0x2D: Total inducted count storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_INDUCTED = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        
        /// <summary>
        /// Nominee data structure for Hall of Fame candidates.
        /// 
        /// FIELDS:
        /// - Name: Nominee display name (max 100 chars)
        /// - Category: Award category (max 50 chars)
        /// - Description: Nominee description (max 500 chars)
        /// - AddedBy: Address of user who nominated
        /// - AddedTime: Unix timestamp of nomination
        /// - TotalVotes: Total GAS votes received
        /// - VoteCount: Number of individual votes
        /// - Inducted: Whether inducted into Hall of Fame
        /// </summary>
        public struct Nominee
        {
            public string Name;
            public string Category;
            public string Description;
            public UInt160 AddedBy;
            public BigInteger AddedTime;
            public BigInteger TotalVotes;
            public BigInteger VoteCount;
            public bool Inducted;
        }

        /// <summary>
        /// Season data structure for voting periods.
        /// 
        /// FIELDS:
        /// - Id: Unique season identifier
        /// - StartTime: Unix timestamp when season started
        /// - EndTime: Unix timestamp when season ends (30 days)
        /// - TotalVotes: Total GAS votes cast this season
        /// - VoterCount: Number of unique voters
        /// - Active: Whether season is currently active
        /// - Settled: Whether season has been settled
        /// </summary>
        public struct Season
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger TotalVotes;
            public BigInteger VoterCount;
            public bool Active;
            public bool Settled;
        }

        /// <summary>
        /// User voting statistics structure.
        /// 
        /// FIELDS:
        /// - TotalVotesCast: Lifetime votes cast by user
        /// - TotalAmountVoted: Total GAS voted by user
        /// - SeasonsParticipated: Number of seasons participated
        /// - LastVoteTime: Unix timestamp of last vote
        /// - RewardsClaimed: Total rewards claimed
        /// </summary>
        public struct UserStats
        {
            public BigInteger TotalVoted;
            public BigInteger VoteCount;
            public BigInteger SeasonsParticipated;
            public BigInteger RewardsClaimed;
            public BigInteger NomineesAdded;
            public BigInteger HighestSingleVote;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region Events
        /// <summary>
        /// Emitted when a vote is recorded.
        /// Parameters: voter, category, nominee, amount, seasonId
        /// </summary>
        [DisplayName("VoteRecorded")]
        public static event VoteRecordedHandler OnVoteRecorded;

        /// <summary>
        /// Emitted when a new nominee is added.
        /// Parameters: category, nominee, addedBy, description
        /// </summary>
        [DisplayName("NomineeAdded")]
        public static event NomineeAddedHandler OnNomineeAdded;

        /// <summary>
        /// Emitted when a new voting season starts.
        /// Parameters: seasonId, startTime, endTime
        /// </summary>
        [DisplayName("SeasonStarted")]
        public static event SeasonStartedHandler OnSeasonStarted;

        /// <summary>
        /// Emitted when a season ends.
        /// Parameters: seasonId, category, winner, totalVotes
        /// </summary>
        [DisplayName("SeasonEnded")]
        public static event SeasonEndedHandler OnSeasonEnded;

        /// <summary>
        /// Emitted when a nominee is inducted into Hall of Fame.
        /// Parameters: category, nominee, totalVotes, seasonId
        /// </summary>
        [DisplayName("Induction")]
        public static event InductionHandler OnInduction;

        /// <summary>
        /// Emitted when a voter claims rewards.
        /// Parameters: voter, seasonId, reward
        /// </summary>
        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        /// <summary>
        /// Emitted when a voter earns a badge.
        /// Parameters: voter, badgeType, badgeName
        /// </summary>
        [DisplayName("VoterBadgeEarned")]
        public static event VoterBadgeEarnedHandler OnVoterBadgeEarned;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// Sets up default categories and initializes counters.
        /// 
        /// DEFAULT CATEGORIES:
        /// - legends: Hall of Fame legends
        /// - communities: Outstanding communities
        /// - developers: Notable developers
        /// - projects: Exceptional projects
        /// </summary>
        /// <param name="data">Deployment data (unused)</param>
        /// <param name="update">Whether this is a contract update</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_NOMINEES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_INDUCTED, 0);

            InitializeCategory("legends");
            InitializeCategory("communities");
            InitializeCategory("developers");
            InitializeCategory("projects");
        }

        /// <summary>
        /// Initializes a voting category.
        /// </summary>
        /// <param name="category">Category name to initialize</param>
        private static void InitializeCategory(string category)
        {
            var key = GetCategoryKey(category);
            Storage.Put(Storage.CurrentContext, key, 1);
        }
        #endregion
    }
}
