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
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get governance constants for frontend calculations.
        /// Frontend should calculate: quorumRequired, quorumReached, passRate, successRate
        /// </summary>
        [Safe]
        public static Map<string, object> GetGovernanceConstants()
        {
            Map<string, object> constants = new Map<string, object>();

            // Core governance parameters
            constants["committeeSize"] = COMMITTEE_SIZE;
            constants["quorumPercent"] = QUORUM_PERCENT;
            constants["thresholdPercent"] = THRESHOLD_PERCENT;
            constants["minDurationSeconds"] = MIN_DURATION_SECONDS;
            constants["maxDurationSeconds"] = MAX_DURATION_SECONDS;

            // Status codes for frontend mapping
            constants["statusPending"] = STATUS_PENDING;
            constants["statusActive"] = STATUS_ACTIVE;
            constants["statusPassed"] = STATUS_PASSED;
            constants["statusRejected"] = STATUS_REJECTED;
            constants["statusRevoked"] = STATUS_REVOKED;
            constants["statusExpired"] = STATUS_EXPIRED;
            constants["statusExecuted"] = STATUS_EXECUTED;

            // Current blockchain state
            constants["currentTime"] = Runtime.Time;

            return constants;
        }

        /// <summary>
        /// Get raw proposal data without calculated fields.
        /// Frontend calculates: totalVotes, quorumRequired, quorumReached, statusString
        /// </summary>
        [Safe]
        public static Map<string, object> GetProposalRaw(BigInteger proposalId)
        {
            Map<string, object> data = new Map<string, object>();
            if (proposalId <= 0 || proposalId > GetProposalCount()) return data;

            var baseKey = GetProposalKey(proposalId);

            // Raw data only - no calculations
            data["id"] = proposalId;
            data["creator"] = (UInt160)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"creator"));
            data["type"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"type"));
            data["title"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"title"));
            data["description"] = (string)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"desc"));
            data["createTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"createTime"));
            data["expiryTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"expiryTime"));
            data["status"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"status"));
            data["yesVotes"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"yesVotes"));
            data["noVotes"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"noVotes"));

            var policyData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(baseKey, (ByteString)"policyData"));
            if (policyData != null)
            {
                data["policyData"] = policyData;
            }

            return data;
        }

        /// <summary>
        /// Get raw member stats without calculated fields.
        /// Frontend calculates: proposalSuccessRate
        /// </summary>
        [Safe]
        public static Map<string, object> GetMemberStatsRaw(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);
            Map<string, object> data = new Map<string, object>();

            // Raw stats only
            data["proposalsCreated"] = stats.ProposalsCreated;
            data["proposalsPassed"] = stats.ProposalsPassed;
            data["proposalsRejected"] = stats.ProposalsRejected;
            data["votesCast"] = stats.VotesCast;
            data["yesVotesCast"] = stats.YesVotesCast;
            data["noVotesCast"] = stats.NoVotesCast;
            data["yesVotesReceived"] = stats.YesVotesReceived;
            data["delegationsReceived"] = stats.DelegationsReceived;
            data["badgeCount"] = stats.BadgeCount;
            data["joinTime"] = stats.JoinTime;
            data["lastActivityTime"] = stats.LastActivityTime;

            // Badge flags (simple lookups, not calculations)
            data["hasFirstProposal"] = HasMemberBadge(member, 1);
            data["hasActiveVoter"] = HasMemberBadge(member, 2);
            data["hasProposalChampion"] = HasMemberBadge(member, 3);
            data["hasConsensusBuilder"] = HasMemberBadge(member, 4);
            data["hasVeteran"] = HasMemberBadge(member, 5);

            UInt160 delegatee = GetDelegatee(member);
            data["hasDelegation"] = delegatee != UInt160.Zero;
            if (delegatee != UInt160.Zero)
            {
                data["delegatee"] = delegatee;
            }

            return data;
        }

        /// <summary>
        /// Get raw platform stats without calculated fields.
        /// Frontend calculates: passRate
        /// </summary>
        [Safe]
        public static Map<string, object> GetPlatformStatsRaw()
        {
            Map<string, object> stats = new Map<string, object>();

            // Raw counters only
            stats["totalProposals"] = GetTotalProposals();
            stats["totalVotes"] = GetTotalVotes();
            stats["passedProposals"] = GetPassedProposals();
            stats["totalMembers"] = GetTotalMembers();
            stats["proposalCount"] = GetProposalCount();

            // Constants (for frontend calculation reference)
            stats["committeeSize"] = COMMITTEE_SIZE;
            stats["quorumPercent"] = QUORUM_PERCENT;
            stats["thresholdPercent"] = THRESHOLD_PERCENT;
            stats["minDurationSeconds"] = MIN_DURATION_SECONDS;
            stats["maxDurationSeconds"] = MAX_DURATION_SECONDS;

            return stats;
        }

        /// <summary>
        /// Get raw voting eligibility data.
        /// Frontend calculates: canVote (combining all conditions)
        /// </summary>
        [Safe]
        public static Map<string, object> GetVotingEligibilityRaw(UInt160 voter, BigInteger proposalId)
        {
            Map<string, object> data = new Map<string, object>();

            // Raw boolean checks
            data["isCandidate"] = IsCandidate(voter);
            data["hasVoted"] = HasVoted(voter, proposalId);

            if (proposalId > 0 && proposalId <= GetProposalCount())
            {
                var baseKey = GetProposalKey(proposalId);
                data["proposalStatus"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"status"));
                data["expiryTime"] = (BigInteger)Storage.Get(Storage.CurrentContext,
                    Helper.Concat(baseKey, (ByteString)"expiryTime"));
            }

            UInt160 delegatee = GetDelegatee(voter);
            data["hasDelegation"] = delegatee != UInt160.Zero;
            if (delegatee != UInt160.Zero)
            {
                data["delegatee"] = delegatee;
            }

            // Current time for frontend comparison
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Batch get multiple proposals raw data for frontend.
        /// Reduces RPC calls by fetching multiple proposals at once.
        /// </summary>
        [Safe]
        public static Map<string, object>[] GetProposalsBatch(BigInteger startId, BigInteger count)
        {
            BigInteger totalCount = GetProposalCount();
            if (startId <= 0) startId = 1;
            if (count <= 0 || count > 50) count = 50; // Max 50 per batch

            BigInteger endId = startId + count - 1;
            if (endId > totalCount) endId = totalCount;

            BigInteger actualCount = endId - startId + 1;
            if (actualCount <= 0) return new Map<string, object>[0];

            Map<string, object>[] results = new Map<string, object>[(int)actualCount];

            for (BigInteger i = 0; i < actualCount; i++)
            {
                results[(int)i] = GetProposalRaw(startId + i);
            }

            return results;
        }

        #endregion
    }
}
