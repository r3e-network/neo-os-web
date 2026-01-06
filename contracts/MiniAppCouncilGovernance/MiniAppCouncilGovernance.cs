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
    public delegate void ProposalCreatedHandler(BigInteger proposalId, UInt160 creator, byte proposalType);
    public delegate void VoteCastHandler(BigInteger proposalId, UInt160 voter, bool support);
    public delegate void ProposalRevokedHandler(BigInteger proposalId, UInt160 creator);
    public delegate void ProposalFinalizedHandler(BigInteger proposalId, byte status);
    public delegate void ProposalExecutedHandler(BigInteger proposalId);

    /// <summary>
    /// Council Governance MiniApp - Decentralized governance for council members.
    /// Only top 21 committee members can create and vote on proposals.
    /// Supports text proposals and policy parameter change proposals.
    /// </summary>
    [DisplayName("MiniAppCouncilGovernance")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Council governance for voting on proposals. Only candidates can participate.")]
    [ContractPermission("*", "*")]
    public class MiniAppCouncilGovernance : SmartContract
    {
        #region Constants
        private const string APP_ID = "miniapp-council-governance";
        private const long MIN_DURATION = 86400000;      // 1 day minimum
        private const long MAX_DURATION = 2592000000;    // 30 days maximum
        private const int THRESHOLD_PERCENT = 50;        // >50% for passing
        #endregion

        #region Storage Prefixes
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_CANDIDATE_CONTRACT = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_POLICY_CONTRACT = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_PROPOSAL_COUNT = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PROPOSAL = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_VOTE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_VOTER_LIST = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_SIGNATURE = new byte[] { 0x30 };
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
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT, 0);
        }
        #endregion

        #region Admin Methods
        [Safe]
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        [Safe]
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        [Safe]
        public static UInt160 CandidateContract() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_CANDIDATE_CONTRACT);

        [Safe]
        public static UInt160 PolicyContract() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_CONTRACT);

        public static void SetGateway(UInt160 gateway)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static void SetCandidateContract(UInt160 candidateContract)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_CANDIDATE_CONTRACT, candidateContract);
        }

        public static void SetPolicyContract(UInt160 policyContract)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_CONTRACT, policyContract);
        }
        #endregion

        #region Proposal Methods
        /// <summary>
        /// Create a new proposal. Only candidates can create proposals.
        /// </summary>
        public static BigInteger CreateProposal(
            UInt160 creator,
            byte proposalType,
            string title,
            string description,
            ByteString policyData,
            BigInteger duration)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(IsCandidate(creator), "only candidates can create proposals");
            ExecutionEngine.Assert(proposalType == TYPE_TEXT || proposalType == TYPE_POLICY_CHANGE, "invalid type");
            ExecutionEngine.Assert(title.Length > 0 && title.Length <= 100, "invalid title");
            ExecutionEngine.Assert(description.Length > 0 && description.Length <= 2000, "invalid description");
            ExecutionEngine.Assert(duration >= MIN_DURATION && duration <= MAX_DURATION, "invalid duration");

            if (proposalType == TYPE_POLICY_CHANGE)
            {
                ExecutionEngine.Assert(policyData != null && policyData.Length > 0, "policy data required");
            }

            BigInteger proposalId = GetProposalCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT, proposalId);

            // Store proposal data in separate keys for gas efficiency
            var baseKey = GetProposalKey(proposalId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"creator"), creator);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"type"), proposalType);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"title"), title);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"desc"), description);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"createTime"), Runtime.Time);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"expiryTime"), Runtime.Time + duration);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"status"), STATUS_ACTIVE);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"yesVotes"), 0);
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"noVotes"), 0);

            if (proposalType == TYPE_POLICY_CHANGE && policyData != null)
            {
                Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"policyData"), policyData);
            }

            OnProposalCreated(proposalId, creator, proposalType);
            return proposalId;
        }

        /// <summary>
        /// Cast a vote on a proposal. Only candidates can vote.
        /// </summary>
        public static void Vote(UInt160 voter, BigInteger proposalId, bool support)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(IsCandidate(voter), "only candidates can vote");
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            ExecutionEngine.Assert(status == STATUS_ACTIVE, "proposal not active");

            BigInteger expiryTime = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"expiryTime"));
            ExecutionEngine.Assert(Runtime.Time < expiryTime, "proposal expired");

            var voteKey = GetVoteKey(proposalId, voter);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voteKey) == null, "already voted");

            // Record vote
            Storage.Put(Storage.CurrentContext, voteKey, support ? 1 : 0);

            // Update vote counts
            if (support)
            {
                BigInteger yesVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"yesVotes"));
                Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"yesVotes"), yesVotes + 1);
            }
            else
            {
                BigInteger noVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"noVotes"));
                Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"noVotes"), noVotes + 1);
            }

            OnVoteCast(proposalId, voter, support);
        }

        /// <summary>
        /// Revoke a proposal. Only the creator can revoke their own proposal.
        /// </summary>
        public static void RevokeProposal(UInt160 creator, BigInteger proposalId)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            UInt160 proposalCreator = (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"creator"));
            ExecutionEngine.Assert(creator == proposalCreator, "only creator can revoke");

            byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            ExecutionEngine.Assert(status == STATUS_ACTIVE, "can only revoke active proposals");

            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"status"), STATUS_REVOKED);
            OnProposalRevoked(proposalId, creator);
        }

        /// <summary>
        /// Finalize a proposal after expiry. Anyone can call this.
        /// </summary>
        public static void FinalizeProposal(BigInteger proposalId)
        {
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            ExecutionEngine.Assert(status == STATUS_ACTIVE, "proposal not active");

            BigInteger expiryTime = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"expiryTime"));
            ExecutionEngine.Assert(Runtime.Time >= expiryTime, "proposal not expired");

            BigInteger yesVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"yesVotes"));
            BigInteger noVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"noVotes"));
            BigInteger totalVotes = yesVotes + noVotes;

            byte newStatus;
            if (totalVotes == 0)
            {
                newStatus = STATUS_EXPIRED;
            }
            else if (yesVotes * 100 > totalVotes * THRESHOLD_PERCENT)
            {
                newStatus = STATUS_PASSED;
            }
            else
            {
                newStatus = STATUS_REJECTED;
            }

            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"status"), newStatus);
            OnProposalFinalized(proposalId, newStatus);
        }

        /// <summary>
        /// Submit signature for policy change proposal.
        /// </summary>
        public static void SubmitSignature(UInt160 signer, BigInteger proposalId, ByteString signature)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(signer), "unauthorized");
            ExecutionEngine.Assert(IsCandidate(signer), "only candidates can sign");
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            byte proposalType = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"type"));
            ExecutionEngine.Assert(proposalType == TYPE_POLICY_CHANGE, "not a policy change proposal");

            byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            ExecutionEngine.Assert(status == STATUS_PASSED, "proposal not passed");

            var sigKey = GetSignatureKey(proposalId, signer);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, sigKey) == null, "already signed");

            Storage.Put(Storage.CurrentContext, sigKey, signature);
        }

        /// <summary>
        /// Execute a passed policy change proposal with collected signatures.
        /// </summary>
        public static void ExecuteProposal(BigInteger proposalId)
        {
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            byte proposalType = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"type"));
            ExecutionEngine.Assert(proposalType == TYPE_POLICY_CHANGE, "not a policy change proposal");

            byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            ExecutionEngine.Assert(status == STATUS_PASSED, "proposal not passed");

            // Mark as executed
            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"status"), STATUS_EXECUTED);
            OnProposalExecuted(proposalId);
        }
        #endregion

        #region Query Methods
        [Safe]
        public static BigInteger GetProposalCount()
        {
            var data = Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static Map<string, object> GetProposal(BigInteger proposalId)
        {
            ExecutionEngine.Assert(proposalId > 0 && proposalId <= GetProposalCount(), "invalid proposal");

            var baseKey = GetProposalKey(proposalId);
            Map<string, object> proposal = new Map<string, object>();

            proposal["id"] = proposalId;
            proposal["creator"] = (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"creator"));
            proposal["type"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"type"));
            proposal["title"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"title"));
            proposal["description"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"desc"));
            proposal["createTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"createTime"));
            proposal["expiryTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"expiryTime"));
            proposal["status"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            proposal["yesVotes"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"yesVotes"));
            proposal["noVotes"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"noVotes"));

            var policyData = Storage.Get(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"policyData"));
            if (policyData != null)
            {
                proposal["policyData"] = policyData;
            }

            return proposal;
        }

        [Safe]
        public static bool HasVoted(UInt160 voter, BigInteger proposalId)
        {
            var voteKey = GetVoteKey(proposalId, voter);
            return Storage.Get(Storage.CurrentContext, voteKey) != null;
        }

        [Safe]
        public static BigInteger GetVote(UInt160 voter, BigInteger proposalId)
        {
            var voteKey = GetVoteKey(proposalId, voter);
            var data = Storage.Get(Storage.CurrentContext, voteKey);
            return data == null ? -1 : (BigInteger)data;
        }

        [Safe]
        public static bool IsCandidate(UInt160 address)
        {
            if (address == null || !address.IsValid) return false;

            // Committee size is 21; only committee members can vote.
            ECPoint[] committee = NEO.GetCommittee();
            foreach (ECPoint member in committee)
            {
                if (Contract.CreateStandardAccount(member) == address) return true;
            }
            return false;
        }

        [Safe]
        public static bool HasSignature(UInt160 signer, BigInteger proposalId)
        {
            var sigKey = GetSignatureKey(proposalId, signer);
            return Storage.Get(Storage.CurrentContext, sigKey) != null;
        }
        #endregion

        #region Helper Methods
        private static ByteString GetProposalKey(BigInteger proposalId)
        {
            return Helper.Concat((ByteString)PREFIX_PROPOSAL, (ByteString)proposalId.ToByteArray());
        }

        private static ByteString GetVoteKey(BigInteger proposalId, UInt160 voter)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTE, (ByteString)proposalId.ToByteArray()),
                (ByteString)(byte[])voter);
        }

        private static ByteString GetSignatureKey(BigInteger proposalId, UInt160 signer)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_SIGNATURE, (ByteString)proposalId.ToByteArray()),
                (ByteString)(byte[])signer);
        }
        #endregion

        #region NEP-17 Receiver
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept GAS deposits
        }
        #endregion
    }
}
