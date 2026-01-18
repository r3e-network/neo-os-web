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
    public delegate void VoteRecordedHandler(UInt160 voter, string category, string nominee, BigInteger amount, BigInteger seasonId);
    public delegate void NomineeAddedHandler(string category, string nominee, UInt160 addedBy, string description);
    public delegate void SeasonStartedHandler(BigInteger seasonId, BigInteger startTime, BigInteger endTime);
    public delegate void SeasonEndedHandler(BigInteger seasonId, string category, string winner, BigInteger totalVotes);
    public delegate void InductionHandler(string category, string nominee, BigInteger totalVotes, BigInteger seasonId);
    public delegate void RewardClaimedHandler(UInt160 voter, BigInteger seasonId, BigInteger reward);
    public delegate void VoterBadgeEarnedHandler(UInt160 voter, BigInteger badgeType, string badgeName);

    [DisplayName("MiniAppHallOfFame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Hall of Fame voting and recognition platform with seasonal cycles")]
    [ContractPermission("*", "*")]
    public partial class MiniAppHallOfFame : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-hall-of-fame";
        private const int MAX_CATEGORY_LENGTH = 50;
        private const int MAX_NOMINEE_LENGTH = 100;
        private const int MAX_DESCRIPTION_LENGTH = 500;
        private const long MIN_VOTE = 10000000;
        private const int SEASON_DURATION_SECONDS = 2592000;
        private const int PLATFORM_FEE_BPS = 500;
        private const int VOTER_REWARD_BPS = 1000;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_CATEGORY = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_NOMINEES = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_VOTE_TOTAL = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_VOTES = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTAL_POOL = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_SEASON_ID = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_SEASONS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_INDUCTED = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_SEASON_VOTES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_VOTER_BADGES = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_VOTERS = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_NOMINEES = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_TOTAL_INDUCTED = new byte[] { 0x2D };
        #endregion

        #region Data Structures
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
        [DisplayName("VoteRecorded")]
        public static event VoteRecordedHandler OnVoteRecorded;

        [DisplayName("NomineeAdded")]
        public static event NomineeAddedHandler OnNomineeAdded;

        [DisplayName("SeasonStarted")]
        public static event SeasonStartedHandler OnSeasonStarted;

        [DisplayName("SeasonEnded")]
        public static event SeasonEndedHandler OnSeasonEnded;

        [DisplayName("Induction")]
        public static event InductionHandler OnInduction;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        [DisplayName("VoterBadgeEarned")]
        public static event VoterBadgeEarnedHandler OnVoterBadgeEarned;
        #endregion

        #region Lifecycle
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

        private static void InitializeCategory(string category)
        {
            var key = GetCategoryKey(category);
            Storage.Put(Storage.CurrentContext, key, 1);
        }
        #endregion
    }
}
