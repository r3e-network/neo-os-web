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
    // Event delegates for CandidateVote lifecycle
    public delegate void VoteRegisteredHandler(UInt160 voter, BigInteger epochId, BigInteger voteWeight);
    public delegate void VoteWithdrawnHandler(UInt160 voter, BigInteger epochId, BigInteger voteWeight);
    public delegate void RewardsDepositedHandler(BigInteger epochId, BigInteger amount);
    public delegate void RewardsClaimedHandler(UInt160 voter, BigInteger epochId, BigInteger amount);
    public delegate void EpochAdvancedHandler(BigInteger oldEpoch, BigInteger newEpoch);
    public delegate void StrategyChangedHandler(BigInteger epochId, string strategy, BigInteger totalVotes);
    public delegate void VoterBadgeEarnedHandler(UInt160 voter, BigInteger badgeType, string badgeName);
    public delegate void DelegationChangedHandler(UInt160 delegator, UInt160 delegatee, BigInteger epochId);

    /// <summary>
    /// CandidateVote MiniApp - Complete platform candidate voting and rewards system.
    ///
    /// FEATURES:
    /// - Epoch-based voting cycles with configurable duration
    /// - Vote weight tracking and delegation
    /// - Proportional GAS rewards distribution
    /// - Multiple voting strategies (self, neoburger)
    /// - Voter statistics and badges
    /// - Vote delegation between users
    /// - Historical epoch data tracking
    ///
    /// MECHANICS:
    /// - Users register votes with NEO weight
    /// - Rewards distributed proportionally at epoch end
    /// - Strategy determined by total votes vs threshold
    /// - Voters earn badges for participation milestones
    /// </summary>
    [DisplayName("MiniAppCandidateVote")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. CandidateVote is a complete platform candidate voting system with epoch cycles, proportional rewards, delegation, badges, and multiple voting strategies.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppCandidateVote : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-candidate-vote";
        private const long EPOCH_DURATION_SECONDS = 604800;    // 7 days
        private const long MIN_VOTE_WEIGHT = 100000000;   // 1 NEO minimum
        private const long DEFAULT_THRESHOLD = 500000000000; // 5000 NEO
        private const string STRATEGY_SELF = "self";
        private const string STRATEGY_NEOBURGER = "neoburger";
        // Voter badges: 1=FirstVote, 2=Consistent(5 epochs), 3=Whale(1000 NEO), 4=Veteran(20 epochs)
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_CANDIDATE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_EPOCH_ID = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_EPOCHS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_VOTER_STATS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_VOTER_EPOCH = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_VOTER_CLAIMED = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_DELEGATIONS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_VOTER_BADGES = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_NEOBURGER = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_THRESHOLD = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_REWARDS = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_TOTAL_VOTERS = new byte[] { 0x2B };
        #endregion

        #region Data Structures

        public struct EpochData
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger TotalVotes;
            public BigInteger TotalRewards;
            public BigInteger VoterCount;
            public string Strategy;
            public bool Finalized;
            public BigInteger RewardsClaimed;
        }

        public struct VoterStats
        {
            public BigInteger TotalVoted;
            public BigInteger EpochsParticipated;
            public BigInteger TotalRewardsClaimed;
            public BigInteger HighestVote;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastVoteTime;
            public UInt160 DelegatedTo;
        }

        public struct VoterEpochData
        {
            public BigInteger VoteWeight;
            public BigInteger DelegatedWeight;
            public BigInteger RewardsClaimed;
            public BigInteger VoteTime;
            public bool Claimed;
        }

        #endregion

        #region App Events
        [DisplayName("VoteRegistered")]
        public static event VoteRegisteredHandler OnVoteRegistered;

        [DisplayName("VoteWithdrawn")]
        public static event VoteWithdrawnHandler OnVoteWithdrawn;

        [DisplayName("RewardsDeposited")]
        public static event RewardsDepositedHandler OnRewardsDeposited;

        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed;

        [DisplayName("EpochAdvanced")]
        public static event EpochAdvancedHandler OnEpochAdvanced;

        [DisplayName("StrategyChanged")]
        public static event StrategyChangedHandler OnStrategyChanged;

        [DisplayName("VoterBadgeEarned")]
        public static event VoterBadgeEarnedHandler OnVoterBadgeEarned;

        [DisplayName("DelegationChanged")]
        public static event DelegationChangedHandler OnDelegationChanged;
        #endregion

        #region Read Methods

        [Safe]
        public static UInt160 PlatformCandidate() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_CANDIDATE);

        [Safe]
        public static BigInteger CurrentEpoch() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EPOCH_ID);

        [Safe]
        public static BigInteger TotalRewardsDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REWARDS);

        [Safe]
        public static BigInteger TotalVoters() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTERS);

        [Safe]
        public static BigInteger CandidateThreshold()
        {
            var data = Storage.Get(Storage.CurrentContext, PREFIX_THRESHOLD);
            return data == null ? DEFAULT_THRESHOLD : (BigInteger)data;
        }

        [Safe]
        public static UInt160 NeoBurger() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_NEOBURGER);

        [Safe]
        public static EpochData GetEpoch(BigInteger epochId)
        {
            byte[] key = GetEpochKey(epochId);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_ID));
            if (data == null) return new EpochData();

            return new EpochData
            {
                Id = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_ID)),
                StartTime = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_START_TIME)),
                EndTime = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_END_TIME)),
                TotalVotes = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_TOTAL_VOTES)),
                TotalRewards = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_TOTAL_REWARDS)),
                VoterCount = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_VOTER_COUNT)),
                Strategy = GetString(Helper.Concat(key, EPOCH_FIELD_STRATEGY)),
                Finalized = GetBool(Helper.Concat(key, EPOCH_FIELD_FINALIZED)),
                RewardsClaimed = GetBigInteger(Helper.Concat(key, EPOCH_FIELD_REWARDS_CLAIMED))
            };
        }

        [Safe]
        public static VoterStats GetVoterStats(UInt160 voter)
        {
            byte[] key = GetVoterStatsKey(voter);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_TOTAL_VOTED));
            if (data == null) return new VoterStats();

            return new VoterStats
            {
                TotalVoted = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_TOTAL_VOTED)),
                EpochsParticipated = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_EPOCHS_PARTICIPATED)),
                TotalRewardsClaimed = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_TOTAL_REWARDS)),
                HighestVote = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_HIGHEST_VOTE)),
                BadgeCount = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_BADGE_COUNT)),
                JoinTime = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_JOIN_TIME)),
                LastVoteTime = GetBigInteger(Helper.Concat(key, VOTER_STATS_FIELD_LAST_VOTE)),
                DelegatedTo = GetUInt160(Helper.Concat(key, VOTER_STATS_FIELD_DELEGATED_TO))
            };
        }

        [Safe]
        public static bool HasVoterBadge(UInt160 voter, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VOTER_BADGES, voter),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_ID, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTERS, 0);

            // Initialize first epoch
            EpochData epoch = new EpochData
            {
                Id = 1,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + EPOCH_DURATION_SECONDS,
                TotalVotes = 0,
                TotalRewards = 0,
                VoterCount = 0,
                Strategy = STRATEGY_NEOBURGER,
                Finalized = false,
                RewardsClaimed = 0
            };
            StoreEpoch(1, epoch);
        }
        #endregion
    }
}
