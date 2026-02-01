using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCouncilGovernance
    {
        #region Query Methods
        [Safe]
        public static BigInteger GetProposalCount()
        {
            var data = Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_COUNT);
            return data == null ? 0 : (BigInteger)data;
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

        [Safe]
        public static UInt160 GetEffectiveVoter(UInt160 voter)
        {
            UInt160 delegatee = GetDelegatee(voter);
            if (delegatee == UInt160.Zero) return voter;
            return delegatee;
        }
        #endregion

        #region Enhanced Query Methods

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
        public static Map<string, object> GetProposalDetails(BigInteger proposalId)
        {
            Map<string, object> details = new Map<string, object>();
            if (proposalId <= 0 || proposalId > GetProposalCount()) return details;

            var baseKey = GetProposalKey(proposalId);

            details["id"] = proposalId;
            details["creator"] = (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"creator"));
            details["type"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"type"));
            details["title"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"title"));
            details["description"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"desc"));
            details["createTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"createTime"));
            details["expiryTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"expiryTime"));

            BigInteger status = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            details["status"] = status;

            BigInteger yesVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"yesVotes"));
            BigInteger noVotes = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"noVotes"));
            details["yesVotes"] = yesVotes;
            details["noVotes"] = noVotes;
            details["totalVotes"] = yesVotes + noVotes;

            BigInteger quorumRequired = COMMITTEE_SIZE * QUORUM_PERCENT / 100;
            details["quorumRequired"] = quorumRequired;
            details["quorumReached"] = (yesVotes + noVotes) >= quorumRequired;

            if (status == STATUS_PENDING) details["statusString"] = "pending";
            else if (status == STATUS_ACTIVE) details["statusString"] = "active";
            else if (status == STATUS_PASSED) details["statusString"] = "passed";
            else if (status == STATUS_REJECTED) details["statusString"] = "rejected";
            else if (status == STATUS_REVOKED) details["statusString"] = "revoked";
            else if (status == STATUS_EXPIRED) details["statusString"] = "expired";
            else if (status == STATUS_EXECUTED) details["statusString"] = "executed";

            return details;
        }

        [Safe]
        public static Map<string, object> GetMemberStatsDetails(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);
            Map<string, object> details = new Map<string, object>();

            details["proposalsCreated"] = stats.ProposalsCreated;
            details["proposalsPassed"] = stats.ProposalsPassed;
            details["proposalsRejected"] = stats.ProposalsRejected;
            details["votesCast"] = stats.VotesCast;
            details["yesVotesCast"] = stats.YesVotesCast;
            details["noVotesCast"] = stats.NoVotesCast;
            details["yesVotesReceived"] = stats.YesVotesReceived;
            details["delegationsReceived"] = stats.DelegationsReceived;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            if (stats.ProposalsCreated > 0)
            {
                details["proposalSuccessRate"] = stats.ProposalsPassed * 10000 / stats.ProposalsCreated;
            }

            details["hasFirstProposal"] = HasMemberBadge(member, 1);
            details["hasActiveVoter"] = HasMemberBadge(member, 2);
            details["hasProposalChampion"] = HasMemberBadge(member, 3);
            details["hasConsensusBuilder"] = HasMemberBadge(member, 4);
            details["hasVeteran"] = HasMemberBadge(member, 5);

            UInt160 delegatee = GetDelegatee(member);
            details["hasDelegation"] = delegatee != UInt160.Zero;
            if (delegatee != UInt160.Zero)
            {
                details["delegatee"] = delegatee;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();

            stats["totalProposals"] = GetTotalProposals();
            stats["totalVotes"] = GetTotalVotes();
            stats["passedProposals"] = GetPassedProposals();
            stats["totalMembers"] = GetTotalMembers();
            stats["proposalCount"] = GetProposalCount();
            stats["committeeSize"] = COMMITTEE_SIZE;
            stats["quorumPercent"] = QUORUM_PERCENT;
            stats["thresholdPercent"] = THRESHOLD_PERCENT;
            stats["minDurationSeconds"] = MIN_DURATION_SECONDS;
            stats["maxDurationSeconds"] = MAX_DURATION_SECONDS;

            BigInteger totalProposals = GetTotalProposals();
            if (totalProposals > 0)
            {
                stats["passRate"] = GetPassedProposals() * 10000 / totalProposals;
            }

            return stats;
        }

        [Safe]
        public static Map<string, object> GetVotingEligibility(UInt160 voter, BigInteger proposalId)
        {
            Map<string, object> eligibility = new Map<string, object>();

            eligibility["isCandidate"] = IsCandidate(voter);
            eligibility["hasVoted"] = HasVoted(voter, proposalId);

            if (proposalId > 0 && proposalId <= GetProposalCount())
            {
                var baseKey = GetProposalKey(proposalId);
                byte status = (byte)(BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"status"));
                BigInteger expiryTime = (BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"expiryTime"));

                eligibility["proposalActive"] = status == STATUS_ACTIVE;
                eligibility["proposalExpired"] = Runtime.Time >= expiryTime;
                eligibility["canVote"] = IsCandidate(voter) && !HasVoted(voter, proposalId) &&
                                         status == STATUS_ACTIVE && Runtime.Time < expiryTime;
            }

            UInt160 delegatee = GetDelegatee(voter);
            eligibility["hasDelegation"] = delegatee != UInt160.Zero;

            return eligibility;
        }
        #endregion
    }
}
