using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMasqueradeDAO
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetMaskDetails(BigInteger maskId)
        {
            MaskData mask = GetMask(maskId);
            Map<string, object> details = new Map<string, object>();
            if (mask.Owner == UInt160.Zero) return details;

            details["id"] = maskId;
            details["owner"] = mask.Owner;
            details["maskType"] = mask.MaskType;
            details["votingPower"] = mask.VotingPower;
            details["effectiveVotingPower"] = GetEffectiveVotingPower(maskId);
            details["reputation"] = mask.Reputation;
            details["delegatedTo"] = mask.DelegatedTo;
            details["createTime"] = mask.CreateTime;
            details["voteCount"] = mask.VoteCount;
            details["proposalsCreated"] = mask.ProposalsCreated;
            details["active"] = mask.Active;

            return details;
        }

        [Safe]
        public static Map<string, object> GetProposalDetails(BigInteger proposalId)
        {
            ProposalData proposal = GetProposal(proposalId);
            Map<string, object> details = new Map<string, object>();
            if (proposal.Id == 0) return details;

            details["id"] = proposal.Id;
            details["creatorMaskId"] = proposal.CreatorMaskId;
            details["title"] = proposal.Title;
            details["description"] = proposal.Description;
            details["category"] = proposal.Category;
            details["startTime"] = proposal.StartTime;
            details["endTime"] = proposal.EndTime;
            details["yesVotes"] = proposal.YesVotes;
            details["noVotes"] = proposal.NoVotes;
            details["abstainVotes"] = proposal.AbstainVotes;
            details["totalVoters"] = proposal.TotalVoters;
            details["executed"] = proposal.Executed;
            details["passed"] = proposal.Passed;

            if (!proposal.Executed && Runtime.Time < proposal.EndTime)
            {
                details["remainingTime"] = proposal.EndTime - Runtime.Time;
                details["status"] = "active";
            }
            else if (!proposal.Executed)
            {
                details["status"] = "pending_execution";
            }
            else
            {
                details["status"] = proposal.Passed ? "passed" : "rejected";
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalMasks"] = TotalMasks();
            stats["totalProposals"] = TotalProposals();
            stats["totalVotes"] = TotalVotes();
            stats["totalMembers"] = TotalMembers();
            stats["proposalsPassed"] = TotalProposalsPassed();
            stats["proposalsRejected"] = TotalProposalsRejected();

            stats["maskFee"] = MASK_FEE;
            stats["premiumMaskFee"] = PREMIUM_MASK_FEE;
            stats["proposalFee"] = PROPOSAL_FEE;
            stats["voteFee"] = VOTE_FEE;
            stats["votingPeriodSeconds"] = DEFAULT_VOTING_PERIOD_SECONDS;
            stats["quorumBps"] = QUORUM_BPS;
            stats["passThresholdBps"] = PASS_THRESHOLD_BPS;

            return stats;
        }

        [Safe]
        public static Map<string, object> GetMemberStatsDetails(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);
            Map<string, object> details = new Map<string, object>();

            details["masksCreated"] = stats.MasksCreated;
            details["activeMasks"] = stats.ActiveMasks;
            details["totalVotes"] = stats.TotalVotes;
            details["proposalsCreated"] = stats.ProposalsCreated;
            details["proposalsPassed"] = stats.ProposalsPassed;
            details["totalReputation"] = stats.TotalReputation;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["maskCount"] = GetUserMaskCount(member);

            return details;
        }

        [Safe]
        public static BigInteger[] GetUserMasks(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserMaskCount(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_MASKS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }
        #endregion
    }
}
