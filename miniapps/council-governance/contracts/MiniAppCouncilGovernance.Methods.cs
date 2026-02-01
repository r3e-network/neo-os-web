using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCouncilGovernance
    {
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
            ExecutionEngine.Assert(duration >= MIN_DURATION_SECONDS && duration <= MAX_DURATION_SECONDS, "invalid duration");

            if (proposalType == TYPE_POLICY_CHANGE)
            {
                ExecutionEngine.Assert(policyData != null && policyData.Length > 0, "policy data required");
            }

            BigInteger proposalId = GetProposalCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT, proposalId);

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

            UpdateMemberStatsOnProposal(creator);

            BigInteger totalProposals = GetTotalProposals();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS, totalProposals + 1);

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

            Storage.Put(Storage.CurrentContext, voteKey, support ? 1 : 0);

            BigInteger yesVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"yesVotes"));
            BigInteger noVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"noVotes"));

            if (support)
            {
                Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"yesVotes"), yesVotes + 1);
                yesVotes += 1;

                UInt160 creator = (UInt160)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"creator"));
                UpdateCreatorYesVotes(creator);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"noVotes"), noVotes + 1);
                noVotes += 1;
            }

            UpdateMemberStatsOnVote(voter, support);

            BigInteger totalVotes = GetTotalVotes();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTES, totalVotes + 1);

            BigInteger totalVotesOnProposal = yesVotes + noVotes;
            BigInteger quorumRequired = COMMITTEE_SIZE * QUORUM_PERCENT / 100;
            if (totalVotesOnProposal == quorumRequired)
            {
                OnQuorumReached(proposalId, totalVotesOnProposal);
            }

            OnVoteCast(proposalId, voter, support);
        }

        /// <summary>
        /// Revoke a proposal. Only the creator can revoke.
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
        /// Finalize a proposal after expiry.
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

            BigInteger quorumRequired = COMMITTEE_SIZE * QUORUM_PERCENT / 100;

            byte newStatus;
            if (totalVotes < quorumRequired)
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

            UInt160 creator = (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"creator"));
            UpdateCreatorStatsOnFinalize(creator, newStatus);

            if (newStatus == STATUS_PASSED)
            {
                BigInteger passedProposals = GetPassedProposals();
                Storage.Put(Storage.CurrentContext, PREFIX_PASSED_PROPOSALS, passedProposals + 1);
            }

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
        /// Execute a passed policy change proposal.
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

            Storage.Put(Storage.CurrentContext, Helper.Concat(baseKey, (ByteString)"status"), STATUS_EXECUTED);
            OnProposalExecuted(proposalId);
        }
        #endregion

        #region Delegation Methods

        /// <summary>
        /// Delegate voting power to another council member.
        /// </summary>
        public static void SetDelegation(UInt160 delegator, UInt160 delegatee)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(delegator), "unauthorized");
            ExecutionEngine.Assert(IsCandidate(delegator), "delegator must be candidate");
            ExecutionEngine.Assert(IsCandidate(delegatee), "delegatee must be candidate");
            ExecutionEngine.Assert(delegator != delegatee, "cannot delegate to self");

            UInt160 existingDelegatee = GetDelegatee(delegatee);
            ExecutionEngine.Assert(existingDelegatee == UInt160.Zero, "delegatee has delegation");

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DELEGATION, delegator),
                delegatee);

            MemberStats stats = GetMemberStats(delegatee);
            stats.DelegationsReceived += 1;
            StoreMemberStats(delegatee, stats);

            OnDelegationSet(delegator, delegatee);
        }

        /// <summary>
        /// Revoke vote delegation.
        /// </summary>
        public static void RevokeDelegation(UInt160 delegator)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(delegator), "unauthorized");

            UInt160 currentDelegatee = GetDelegatee(delegator);
            ExecutionEngine.Assert(currentDelegatee != UInt160.Zero, "no delegation");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DELEGATION, delegator));

            MemberStats stats = GetMemberStats(currentDelegatee);
            if (stats.DelegationsReceived > 0)
            {
                stats.DelegationsReceived -= 1;
                StoreMemberStats(currentDelegatee, stats);
            }

            OnDelegationRevoked(delegator);
        }
        #endregion
    }
}
