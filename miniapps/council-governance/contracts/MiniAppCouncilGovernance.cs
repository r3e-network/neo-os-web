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
    /// <summary>Event emitted when proposal created.</summary>
    public delegate void ProposalCreatedHandler(BigInteger proposalId, UInt160 creator, byte proposalType);
    /// <summary>Event emitted when vote cast.</summary>
    public delegate void VoteCastHandler(BigInteger proposalId, UInt160 voter, bool support);
    /// <summary>Event emitted when proposal revoked.</summary>
    public delegate void ProposalRevokedHandler(BigInteger proposalId, UInt160 creator);
    /// <summary>Event emitted when proposal finalized.</summary>
    public delegate void ProposalFinalizedHandler(BigInteger proposalId, byte status);
    /// <summary>Event emitted when proposal executed.</summary>
    public delegate void ProposalExecutedHandler(BigInteger proposalId);
    /// <summary>Event emitted when member badge earned.</summary>
    public delegate void MemberBadgeEarnedHandler(UInt160 member, BigInteger badgeType, string badgeName);
    /// <summary>Event emitted when delegation set.</summary>
    public delegate void DelegationSetHandler(UInt160 delegator, UInt160 delegatee);
    /// <summary>Event emitted when delegation revoked.</summary>
    public delegate void DelegationRevokedHandler(UInt160 delegator);
    /// <summary>Event emitted when quorum reached.</summary>
    public delegate void QuorumReachedHandler(BigInteger proposalId, BigInteger totalVotes);

    /// <summary>
    /// Council Governance MiniApp - Decentralized governance for council members.
    /// Only top 21 committee members can create and vote on proposals.
    /// Supports text proposals, policy parameter change proposals, and vote delegation.
    ///
    /// FEATURES:
    /// - Text and policy change proposals
    /// - Vote delegation to other council members
    /// - Member statistics and badge system
    /// - Quorum requirements for proposal validity
    /// - Signature collection for policy execution
    ///
    /// BADGES:
    /// - 1=FirstProposal, 2=ActiveVoter(10 votes), 3=ProposalChampion(5 passed),
    /// - 4=ConsensusBuilder(10 yes votes received), 5=Veteran(50 votes cast)
    /// </summary>
    [DisplayName("MiniAppCouncilGovernance")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. CouncilGovernance is a decentralized governance application for council voting. Use it to create and vote on proposals, you can participate in on-chain governance with vote delegation and badge rewards.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppCouncilGovernance : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the council-governance miniapp.</summary>
        private const string APP_ID = "miniapp-council-governance";
        /// <summary>Minimum value for operation.</summary>
        /// <summary>Duration in seconds .</summary>
        private const long MIN_DURATION_SECONDS = 86400;      // 1 day minimum
        /// <summary>Maximum allowed value .</summary>
        private const long MAX_DURATION_SECONDS = 2592000;    // 30 days maximum
        private const int THRESHOLD_PERCENT = 50;        // >50% for passing
        private const int QUORUM_PERCENT = 30;           // 30% of committee must vote
        private const int COMMITTEE_SIZE = 21;           // Neo committee size
        // Badges: 1=FirstProposal, 2=ActiveVoter(10 votes), 3=ProposalChampion(5 passed),
        //         4=ConsensusBuilder(10 yes votes received), 5=Veteran(50 votes cast)
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Storage prefix for candidate contract.</summary>
        private static readonly byte[] PREFIX_CANDIDATE_CONTRACT = new byte[] { 0x20 };
        /// <summary>Storage prefix for policy contract.</summary>
        private static readonly byte[] PREFIX_POLICY_CONTRACT = new byte[] { 0x21 };
        /// <summary>Storage prefix for proposal count.</summary>
        private static readonly byte[] PREFIX_PROPOSAL_COUNT = new byte[] { 0x22 };
        /// <summary>Storage prefix for proposal.</summary>
        private static readonly byte[] PREFIX_PROPOSAL = new byte[] { 0x23 };
        /// <summary>Storage prefix for vote.</summary>
        private static readonly byte[] PREFIX_VOTE = new byte[] { 0x24 };
        /// <summary>Storage prefix for voter list.</summary>
        private static readonly byte[] PREFIX_VOTER_LIST = new byte[] { 0x25 };
        /// <summary>Storage prefix for signature.</summary>
        private static readonly byte[] PREFIX_SIGNATURE = new byte[] { 0x26 };
        /// <summary>Storage prefix for member stats.</summary>
        private static readonly byte[] PREFIX_MEMBER_STATS = new byte[] { 0x27 };
        /// <summary>Storage prefix for member badges.</summary>
        private static readonly byte[] PREFIX_MEMBER_BADGES = new byte[] { 0x28 };
        /// <summary>Storage prefix for delegation.</summary>
        private static readonly byte[] PREFIX_DELEGATION = new byte[] { 0x29 };
        /// <summary>Storage prefix for total proposals.</summary>
        private static readonly byte[] PREFIX_TOTAL_PROPOSALS = new byte[] { 0x2A };
        /// <summary>Storage prefix for total votes.</summary>
        private static readonly byte[] PREFIX_TOTAL_VOTES = new byte[] { 0x2B };
        /// <summary>Storage prefix for passed proposals.</summary>
        private static readonly byte[] PREFIX_PASSED_PROPOSALS = new byte[] { 0x2C };
        /// <summary>Storage prefix for total members.</summary>
        private static readonly byte[] PREFIX_TOTAL_MEMBERS = new byte[] { 0x2D };
        #endregion

        #region Enums
        public const byte TYPE_TEXT = 0;
        public const byte TYPE_POLICY_CHANGE = 1;

        public const byte STATUS_PENDING = 0;
        public const byte STATUS_ACTIVE = 1;
        public const byte STATUS_PASSED = 2;
        public const byte STATUS_REJECTED = 3;
        public const byte STATUS_REVOKED = 4;
        public const byte STATUS_EXPIRED = 5;
        public const byte STATUS_EXECUTED = 6;
        #endregion

        #region Data Structures
        public struct MemberStats
        {
            public BigInteger ProposalsCreated;
            public BigInteger ProposalsPassed;
            public BigInteger ProposalsRejected;
            public BigInteger VotesCast;
            public BigInteger YesVotesCast;
            public BigInteger NoVotesCast;
            public BigInteger YesVotesReceived;
            public BigInteger DelegationsReceived;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region Events
        [DisplayName("ProposalCreated")]
        public static event ProposalCreatedHandler OnProposalCreated;

        [DisplayName("VoteCast")]
        public static event VoteCastHandler OnVoteCast;

        [DisplayName("ProposalRevoked")]
        public static event ProposalRevokedHandler OnProposalRevoked;

        [DisplayName("ProposalFinalized")]
        public static event ProposalFinalizedHandler OnProposalFinalized;

        [DisplayName("ProposalExecuted")]
        public static event ProposalExecutedHandler OnProposalExecuted;

        [DisplayName("MemberBadgeEarned")]
        public static event MemberBadgeEarnedHandler OnMemberBadgeEarned;

        [DisplayName("DelegationSet")]
        public static event DelegationSetHandler OnDelegationSet;

        [DisplayName("DelegationRevoked")]
        public static event DelegationRevokedHandler OnDelegationRevoked;

        [DisplayName("QuorumReached")]
        public static event QuorumReachedHandler OnQuorumReached;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PASSED_PROPOSALS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS, 0);
        }
        #endregion

        #region Admin Methods
        [Safe]
        public static UInt160 CandidateContract() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_CANDIDATE_CONTRACT);

        [Safe]
        public static UInt160 PolicyContract() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_CONTRACT);

        public static void SetCandidateContract(UInt160 candidateContract)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_CANDIDATE_CONTRACT, candidateContract);
        }

        public static void SetPolicyContract(UInt160 policyContract)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_CONTRACT, policyContract);
        }
        #endregion

        #region Read Methods

        [Safe]
        public static BigInteger GetTotalProposals() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS);

        [Safe]
        public static BigInteger GetTotalVotes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTES);

        [Safe]
        public static BigInteger GetPassedProposals() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PASSED_PROPOSALS);

        [Safe]
        public static BigInteger GetTotalMembers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS);

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
        public static UInt160 GetDelegatee(UInt160 delegator)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DELEGATION, delegator));
            if (data == null) return UInt160.Zero;
            return (UInt160)data;
        }

        #endregion
    }
}
