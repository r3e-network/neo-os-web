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
    /// MasqueradeDAO MiniApp - Anonymous DAO governance with mask identities.
    ///
    /// KEY FEATURES:
    /// - Anonymous mask identities for voting
    /// - Multiple mask types with different voting power
    /// - Proposal creation and voting system
    /// - Vote delegation between masks
    /// - Reputation system for participation
    /// - Proposal categories and quorum requirements
    ///
    /// SECURITY:
    /// - TEE-verified identity verification
    /// - Vote privacy protection
    /// - Proposal execution thresholds
    /// - Anti-sybil mechanisms
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for fees
    /// </summary>
    [DisplayName("MiniAppMasqueradeDAO")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "MasqueradeDAO is a complete anonymous DAO governance platform with mask identities, proposals, delegation, reputation, and TEE-verified privacy.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppMasqueradeDAO : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the MasqueradeDAO miniapp.</summary>
        /// <summary>Unique application identifier for the masquerade-dao miniapp.</summary>
        private const string APP_ID = "miniapp-masqueradedao";
        
        /// <summary>Basic mask fee 0.1 GAS (10,000,000).</summary>
        private const long MASK_FEE = 10000000;
        
        /// <summary>Premium mask fee 0.5 GAS (50,000,000).</summary>
        private const long PREMIUM_MASK_FEE = 50000000;
        
        /// <summary>Proposal creation fee 0.2 GAS (20,000,000).</summary>
        private const long PROPOSAL_FEE = 20000000;
        
        /// <summary>Voting fee 0.01 GAS (1,000,000).</summary>
        private const long VOTE_FEE = 1000000;
        
        /// <summary>Default voting period 7 days (604,800 seconds).</summary>
        private const long DEFAULT_VOTING_PERIOD_SECONDS = 604800;
        
        /// <summary>Quorum requirement 10% (1000 bps).</summary>
        private const int QUORUM_BPS = 1000;
        
        /// <summary>Pass threshold 50% (5000 bps).</summary>
        private const int PASS_THRESHOLD_BPS = 5000;
        
        /// <summary>Maximum proposal title length.</summary>
        private const int MAX_TITLE_LENGTH = 200;
        
        /// <summary>Maximum proposal description length.</summary>
        private const int MAX_DESCRIPTION_LENGTH = 2000;
        
        // Mask types: 1=Basic(1 vote), 2=Premium(3 votes), 3=Founder(5 votes)
        // Proposal categories: 1=Governance, 2=Treasury, 3=Membership, 4=Other
        // Vote choices: 1=Yes, 2=No, 3=Abstain
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: Current mask ID counter.</summary>
        /// <summary>Storage prefix for mask id.</summary>
        private static readonly byte[] PREFIX_MASK_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Mask data storage.</summary>
        /// <summary>Storage prefix for masks.</summary>
        private static readonly byte[] PREFIX_MASKS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Proposal data storage.</summary>
        /// <summary>Storage prefix for proposals.</summary>
        private static readonly byte[] PREFIX_PROPOSALS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Vote data storage.</summary>
        /// <summary>Storage prefix for votes.</summary>
        private static readonly byte[] PREFIX_VOTES = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Current proposal ID counter.</summary>
        /// <summary>Storage prefix for proposal id.</summary>
        private static readonly byte[] PREFIX_PROPOSAL_ID = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Delegation tracking.</summary>
        /// <summary>Storage prefix for delegations.</summary>
        private static readonly byte[] PREFIX_DELEGATIONS = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: User mask list.</summary>
        /// <summary>Storage prefix for user masks.</summary>
        private static readonly byte[] PREFIX_USER_MASKS = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: User mask count.</summary>
        /// <summary>Storage prefix for user mask count.</summary>
        private static readonly byte[] PREFIX_USER_MASK_COUNT = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: Total votes cast.</summary>
        /// <summary>Storage prefix for total votes.</summary>
        private static readonly byte[] PREFIX_TOTAL_VOTES = new byte[] { 0x28 };
        
        /// <summary>Prefix 0x29: Total proposals created.</summary>
        /// <summary>Storage prefix for total proposals.</summary>
        private static readonly byte[] PREFIX_TOTAL_PROPOSALS = new byte[] { 0x29 };
        
        /// <summary>Prefix 0x2A: Member statistics.</summary>
        /// <summary>Storage prefix for member stats.</summary>
        private static readonly byte[] PREFIX_MEMBER_STATS = new byte[] { 0x2A };
        
        /// <summary>Prefix 0x2B: Member badges.</summary>
        /// <summary>Storage prefix for member badges.</summary>
        private static readonly byte[] PREFIX_MEMBER_BADGES = new byte[] { 0x2B };
        
        /// <summary>Prefix 0x2C: Total members.</summary>
        /// <summary>Storage prefix for total members.</summary>
        private static readonly byte[] PREFIX_TOTAL_MEMBERS = new byte[] { 0x2C };
        
        /// <summary>Prefix 0x2D: Proposals passed count.</summary>
        /// <summary>Storage prefix for proposals passed.</summary>
        private static readonly byte[] PREFIX_PROPOSALS_PASSED = new byte[] { 0x2D };
        
        /// <summary>Prefix 0x2E: Proposals rejected count.</summary>
        /// <summary>Storage prefix for proposals rejected.</summary>
        private static readonly byte[] PREFIX_PROPOSALS_REJECTED = new byte[] { 0x2E };
        #endregion

        #region Data Structures
        /// <summary>
        /// Anonymous mask identity for voting.
        /// FIELDS:
        /// - Owner: Mask owner's address
        /// - IdentityHash: Hashed identity verification
        /// - MaskType: 1=Basic, 2=Premium, 3=Founder
        /// - VotingPower: Votes per ballot (based on type)
        /// - Reputation: Participation score
        /// - DelegatedTo: Mask ID delegated to (0 if none)
        /// - CreateTime: Creation timestamp
        /// - VoteCount: Total votes cast
        /// - ProposalsCreated: Count of proposals created
        /// - Active: Whether mask is active
        /// </summary>
        public struct MaskData
        {
            public UInt160 Owner;
            public ByteString IdentityHash;
            public BigInteger MaskType;
            public BigInteger VotingPower;
            public BigInteger Reputation;
            public BigInteger DelegatedTo;
            public BigInteger CreateTime;
            public BigInteger VoteCount;
            public BigInteger ProposalsCreated;
            public bool Active;
        }

        /// <summary>
        /// Governance proposal.
        /// FIELDS:
        /// - Id: Proposal number
        /// - Creator: Creator address
        /// - CreatorMaskId: Mask used to create
        /// - Title: Proposal title
        /// - Description: Full description
        /// - Category: 1=Governance, 2=Treasury, 3=Membership, 4=Other
        /// - StartTime: Voting start timestamp
        /// - EndTime: Voting end timestamp
        /// - YesVotes: Total yes voting power
        /// - NoVotes: Total no voting power
        /// - AbstainVotes: Total abstain voting power
        /// - TotalVoters: Unique voter count
        /// - Executed: Whether executed
        /// - Passed: Whether passed
        /// </summary>
        public struct ProposalData
        {
            public BigInteger Id;
            public UInt160 Creator;
            public BigInteger CreatorMaskId;
            public string Title;
            public string Description;
            public BigInteger Category;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger YesVotes;
            public BigInteger NoVotes;
            public BigInteger AbstainVotes;
            public BigInteger TotalVoters;
            public bool Executed;
            public bool Passed;
        }

        /// <summary>
        /// Individual vote record.
        /// FIELDS:
        /// - MaskId: Voting mask
        /// - Choice: 1=Yes, 2=No, 3=Abstain
        /// - VotingPower: Power used
        /// - Timestamp: Vote timestamp
        /// </summary>
        public struct VoteData
        {
            public BigInteger MaskId;
            public BigInteger Choice;
            public BigInteger VotingPower;
            public BigInteger Timestamp;
        }

        /// <summary>
        /// Member statistics.
        /// FIELDS:
        /// - MasksCreated: Total masks owned
        /// - ActiveMasks: Currently active masks
        /// - TotalVotes: Votes cast
        /// - ProposalsCreated: Proposals submitted
        /// - ProposalsPassed: Successful proposals
        /// - TotalReputation: Combined reputation
        /// - DelegationsReceived: Delegations to member
        /// - DelegationsGiven: Delegations from member
        /// - BadgeCount: Badges earned
        /// - JoinTime: First mask creation
        /// - LastActivityTime: Most recent activity
        /// - HighestReputation: Peak reputation
        /// - PremiumMasks: Premium mask count
        /// </summary>
        public struct MemberStats
        {
            public BigInteger MasksCreated;
            public BigInteger ActiveMasks;
            public BigInteger TotalVotes;
            public BigInteger ProposalsCreated;
            public BigInteger ProposalsPassed;
            public BigInteger TotalReputation;
            public BigInteger DelegationsReceived;
            public BigInteger DelegationsGiven;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger HighestReputation;
            public BigInteger PremiumMasks;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when mask is created.</summary>
        /// <param name="maskId">New mask identifier.</param>
        /// <param name="owner">Mask owner address.</param>
        /// <param name="maskType">Type of mask created.</param>
        /// <summary>Event emitted when mask created.</summary>
    public delegate void MaskCreatedHandler(BigInteger maskId, UInt160 owner, BigInteger maskType);
        
        /// <summary>Event emitted when vote is submitted.</summary>
        /// <param name="proposalId">Proposal voted on.</param>
        /// <param name="maskId">Voting mask.</param>
        /// <param name="choice">Vote choice (1=Yes, 2=No, 3=Abstain).</param>
        /// <summary>Event emitted when vote submitted.</summary>
    public delegate void VoteSubmittedHandler(BigInteger proposalId, BigInteger maskId, BigInteger choice);
        
        /// <summary>Event emitted when identity is revealed.</summary>
        /// <param name="maskId">Revealed mask.</param>
        /// <param name="realIdentity">Real address revealed.</param>
        /// <summary>Event emitted when identity revealed.</summary>
    public delegate void IdentityRevealedHandler(BigInteger maskId, UInt160 realIdentity);
        
        /// <summary>Event emitted when proposal is created.</summary>
        /// <param name="proposalId">New proposal identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="title">Proposal title.</param>
        /// <param name="endTime">Voting end timestamp.</param>
        /// <summary>Event emitted when proposal created.</summary>
    public delegate void ProposalCreatedHandler(BigInteger proposalId, UInt160 creator, string title, BigInteger endTime);
        
        /// <summary>Event emitted when proposal is executed.</summary>
        /// <param name="proposalId">Proposal identifier.</param>
        /// <param name="passed">Whether proposal passed.</param>
        /// <param name="yesVotes">Total yes votes.</param>
        /// <param name="noVotes">Total no votes.</param>
        /// <summary>Event emitted when proposal executed.</summary>
    public delegate void ProposalExecutedHandler(BigInteger proposalId, bool passed, BigInteger yesVotes, BigInteger noVotes);
        
        /// <summary>Event emitted when delegation changes.</summary>
        /// <param name="maskId">Delegating mask.</param>
        /// <param name="delegateToMaskId">Delegate target mask (0 to remove).</param>
        /// <summary>Event emitted when delegation changed.</summary>
    public delegate void DelegationChangedHandler(BigInteger maskId, BigInteger delegateToMaskId);
        
        /// <summary>Event emitted when mask is deactivated.</summary>
        /// <param name="maskId">Deactivated mask.</param>
        /// <param name="owner">Owner address.</param>
        /// <summary>Event emitted when mask deactivated.</summary>
    public delegate void MaskDeactivatedHandler(BigInteger maskId, UInt160 owner);
        
        /// <summary>Event emitted when reputation changes.</summary>
        /// <param name="maskId">Mask with reputation change.</param>
        /// <param name="newReputation">Updated reputation score.</param>
        /// <param name="reason">Reason for change.</param>
        /// <summary>Event emitted when reputation changed.</summary>
    public delegate void ReputationChangedHandler(BigInteger maskId, BigInteger newReputation, string reason);
        
        /// <summary>Event emitted when member earns badge.</summary>
        /// <param name="member">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        /// <summary>Event emitted when member badge earned.</summary>
    public delegate void MemberBadgeEarnedHandler(UInt160 member, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("MaskCreated")]
        public static event MaskCreatedHandler OnMaskCreated;

        [DisplayName("VoteSubmitted")]
        public static event VoteSubmittedHandler OnVoteSubmitted;

        [DisplayName("IdentityRevealed")]
        public static event IdentityRevealedHandler OnIdentityRevealed;

        [DisplayName("ProposalCreated")]
        public static event ProposalCreatedHandler OnProposalCreated;

        [DisplayName("ProposalExecuted")]
        public static event ProposalExecutedHandler OnProposalExecuted;

        [DisplayName("DelegationChanged")]
        public static event DelegationChangedHandler OnDelegationChanged;

        [DisplayName("MaskDeactivated")]
        public static event MaskDeactivatedHandler OnMaskDeactivated;

        [DisplayName("ReputationChanged")]
        public static event ReputationChangedHandler OnReputationChanged;

        [DisplayName("MemberBadgeEarned")]
        public static event MemberBadgeEarnedHandler OnMemberBadgeEarned;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MASK_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSALS_PASSED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSALS_REJECTED, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total masks created.
        /// </summary>
        /// <returns>Total mask count.</returns>
        [Safe]
        public static BigInteger TotalMasks() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MASK_ID);

        /// <summary>
        /// Gets total proposals created.
        /// </summary>
        /// <returns>Total proposal count.</returns>
        [Safe]
        public static BigInteger TotalProposals() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_ID);

        /// <summary>
        /// Gets total votes cast.
        /// </summary>
        /// <returns>Total vote count.</returns>
        [Safe]
        public static BigInteger TotalVotes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTES);

        /// <summary>
        /// Gets total unique members.
        /// </summary>
        /// <returns>Total member count.</returns>
        [Safe]
        public static BigInteger TotalMembers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS);

        /// <summary>
        /// Gets total passed proposals.
        /// </summary>
        /// <returns>Passed proposal count.</returns>
        [Safe]
        public static BigInteger TotalProposalsPassed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSALS_PASSED);

        /// <summary>
        /// Gets total rejected proposals.
        /// </summary>
        /// <returns>Rejected proposal count.</returns>
        [Safe]
        public static BigInteger TotalProposalsRejected() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSALS_REJECTED);

        /// <summary>
        /// Gets member statistics.
        /// </summary>
        /// <param name="member">Member address.</param>
        /// <returns>Member stats struct.</returns>
        [Safe]
        public static MemberStats GetMemberStats(UInt160 member)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMBER_STATS, member));
            if (data == null) return new MemberStats();
            return (MemberStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Checks if member has a specific badge.
        /// </summary>
        /// <param name="member">Member address.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <returns>True if member has badge.</returns>
        [Safe]
        public static bool HasMemberBadge(UInt160 member, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_MEMBER_BADGES, member),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        /// <summary>
        /// Gets mask data by ID.
        /// </summary>
        /// <param name="maskId">Mask identifier.</param>
        /// <returns>Mask data struct.</returns>
        [Safe]
        public static MaskData GetMask(BigInteger maskId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MASKS, (ByteString)maskId.ToByteArray()));
            if (data == null) return new MaskData();
            return (MaskData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets proposal data by ID.
        /// </summary>
        /// <param name="proposalId">Proposal identifier.</param>
        /// <returns>Proposal data struct.</returns>
        [Safe]
        public static ProposalData GetProposal(BigInteger proposalId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSALS, (ByteString)proposalId.ToByteArray()));
            if (data == null) return new ProposalData();
            return (ProposalData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets mask count for a user.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Number of masks owned.</returns>
        [Safe]
        public static BigInteger GetUserMaskCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_MASK_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Gets delegation target for a mask.
        /// </summary>
        /// <param name="maskId">Mask identifier.</param>
        /// <returns>Delegated mask ID (0 if none).</returns>
        [Safe]
        public static BigInteger GetDelegation(BigInteger maskId)
        {
            byte[] key = Helper.Concat(PREFIX_DELEGATIONS, (ByteString)maskId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion
    }
}
