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
    // Event delegates for MasqueradeDAO lifecycle
    public delegate void MaskCreatedHandler(BigInteger maskId, UInt160 owner, BigInteger maskType);
    public delegate void VoteSubmittedHandler(BigInteger proposalId, BigInteger maskId, BigInteger choice);
    public delegate void IdentityRevealedHandler(BigInteger maskId, UInt160 realIdentity);
    public delegate void ProposalCreatedHandler(BigInteger proposalId, UInt160 creator, string title, BigInteger endTime);
    public delegate void ProposalExecutedHandler(BigInteger proposalId, bool passed, BigInteger yesVotes, BigInteger noVotes);
    public delegate void DelegationChangedHandler(BigInteger maskId, BigInteger delegateToMaskId);
    public delegate void MaskDeactivatedHandler(BigInteger maskId, UInt160 owner);
    public delegate void ReputationChangedHandler(BigInteger maskId, BigInteger newReputation, string reason);
    public delegate void MemberBadgeEarnedHandler(UInt160 member, BigInteger badgeType, string badgeName);

    /// <summary>
    /// MasqueradeDAO MiniApp - Complete anonymous DAO governance platform.
    ///
    /// FEATURES:
    /// - Multiple mask types with different voting weights
    /// - Proposal creation and voting system
    /// - Vote delegation between masks
    /// - Reputation system for active participants
    /// - Proposal categories (governance, treasury, membership)
    /// - Quorum and threshold requirements
    /// - User statistics and participation tracking
    ///
    /// MECHANICS:
    /// - Create anonymous mask identities with TEE verification
    /// - Submit proposals with configurable voting periods
    /// - Vote anonymously using mask identities
    /// - Delegate voting power to other masks
    /// - Earn reputation through participation
    /// - Execute passed proposals automatically
    /// </summary>
    [DisplayName("MiniAppMasqueradeDAO")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. MasqueradeDAO is a complete anonymous DAO governance platform with mask identities, proposals, delegation, reputation, and TEE-verified privacy.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppMasqueradeDAO : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-masqueradedao";
        private const long MASK_FEE = 10000000;             // 0.1 GAS basic mask
        private const long PREMIUM_MASK_FEE = 50000000;     // 0.5 GAS premium mask
        private const long PROPOSAL_FEE = 20000000;         // 0.2 GAS to create proposal
        private const long VOTE_FEE = 1000000;              // 0.01 GAS per vote
        private const long DEFAULT_VOTING_PERIOD_SECONDS = 604800; // 7 days
        private const int QUORUM_BPS = 1000;                // 10% quorum
        private const int PASS_THRESHOLD_BPS = 5000;        // 50% to pass
        private const int MAX_TITLE_LENGTH = 200;
        private const int MAX_DESCRIPTION_LENGTH = 2000;
        // Mask types: 1=Basic(1 vote), 2=Premium(3 votes), 3=Founder(5 votes)
        // Proposal categories: 1=Governance, 2=Treasury, 3=Membership, 4=Other
        // Vote choices: 1=Yes, 2=No, 3=Abstain
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_MASK_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_MASKS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_PROPOSALS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_VOTES = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_PROPOSAL_ID = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_DELEGATIONS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_USER_MASKS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_USER_MASK_COUNT = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_VOTES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_PROPOSALS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_MEMBER_STATS = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_MEMBER_BADGES = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_MEMBERS = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_PROPOSALS_PASSED = new byte[] { 0x2D };
        private static readonly byte[] PREFIX_PROPOSALS_REJECTED = new byte[] { 0x2E };
        #endregion

        #region Data Structures
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

        public struct VoteData
        {
            public BigInteger MaskId;
            public BigInteger Choice;
            public BigInteger VotingPower;
            public BigInteger Timestamp;
        }

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

        #region App Events
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
        [Safe]
        public static BigInteger TotalMasks() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MASK_ID);

        [Safe]
        public static BigInteger TotalProposals() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_ID);

        [Safe]
        public static BigInteger TotalVotes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTES);

        [Safe]
        public static BigInteger TotalMembers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS);

        [Safe]
        public static BigInteger TotalProposalsPassed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSALS_PASSED);

        [Safe]
        public static BigInteger TotalProposalsRejected() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSALS_REJECTED);

        [Safe]
        public static MemberStats GetMemberStats(UInt160 member)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMBER_STATS, member));
            if (data == null) return new MemberStats();
            return (MemberStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasMemberBadge(UInt160 member, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_MEMBER_BADGES, member),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static MaskData GetMask(BigInteger maskId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MASKS, (ByteString)maskId.ToByteArray()));
            if (data == null) return new MaskData();
            return (MaskData)StdLib.Deserialize(data);
        }

        [Safe]
        public static ProposalData GetProposal(BigInteger proposalId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSALS, (ByteString)proposalId.ToByteArray()));
            if (data == null) return new ProposalData();
            return (ProposalData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserMaskCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_MASK_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetDelegation(BigInteger maskId)
        {
            byte[] key = Helper.Concat(PREFIX_DELEGATIONS, (ByteString)maskId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion
    }
}
