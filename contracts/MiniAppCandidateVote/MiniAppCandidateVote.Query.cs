using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCandidateVote
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetEpochDetails(BigInteger epochId)
        {
            EpochData epoch = GetEpoch(epochId);
            Map<string, object> details = new Map<string, object>();
            if (epoch.Id == 0) return details;

            details["id"] = epoch.Id;
            details["startTime"] = epoch.StartTime;
            details["endTime"] = epoch.EndTime;
            details["totalVotes"] = epoch.TotalVotes;
            details["totalRewards"] = epoch.TotalRewards;
            details["voterCount"] = epoch.VoterCount;
            details["strategy"] = epoch.Strategy;
            details["finalized"] = epoch.Finalized;
            details["rewardsClaimed"] = epoch.RewardsClaimed;

            // Calculate status
            if (epoch.Finalized)
            {
                details["status"] = "finalized";
            }
            else if (Runtime.Time >= epoch.EndTime)
            {
                details["status"] = "ended";
            }
            else
            {
                details["status"] = "active";
                details["remainingTime"] = epoch.EndTime - Runtime.Time;
            }

            // Calculate threshold status
            BigInteger threshold = CandidateThreshold();
            details["threshold"] = threshold;
            details["thresholdReached"] = epoch.TotalVotes >= threshold;
            details["votesNeeded"] = epoch.TotalVotes >= threshold ? 0 : threshold - epoch.TotalVotes;

            return details;
        }

        [Safe]
        public static Map<string, object> GetVoterStatsDetails(UInt160 voter)
        {
            VoterStats stats = GetVoterStats(voter);
            Map<string, object> details = new Map<string, object>();

            details["totalVoted"] = stats.TotalVoted;
            details["epochsParticipated"] = stats.EpochsParticipated;
            details["totalRewardsClaimed"] = stats.TotalRewardsClaimed;
            details["highestVote"] = stats.HighestVote;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastVoteTime"] = stats.LastVoteTime;
            details["delegatedTo"] = stats.DelegatedTo;

            // Check badge status
            details["hasFirstVote"] = HasVoterBadge(voter, 1);
            details["hasConsistent"] = HasVoterBadge(voter, 2);
            details["hasWhale"] = HasVoterBadge(voter, 3);
            details["hasVeteran"] = HasVoterBadge(voter, 4);
            details["hasLoyalVoter"] = HasVoterBadge(voter, 5);
            details["hasTopContributor"] = HasVoterBadge(voter, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetVoterEpochDetails(UInt160 voter, BigInteger epochId)
        {
            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);
            EpochData epoch = GetEpoch(epochId);
            Map<string, object> details = new Map<string, object>();

            details["voteWeight"] = voterEpoch.VoteWeight;
            details["delegatedWeight"] = voterEpoch.DelegatedWeight;
            details["rewardsClaimed"] = voterEpoch.RewardsClaimed;
            details["voteTime"] = voterEpoch.VoteTime;
            details["claimed"] = voterEpoch.Claimed;

            // Calculate pending reward
            if (!voterEpoch.Claimed && voterEpoch.VoteWeight > 0 && epoch.Finalized)
            {
                BigInteger pendingReward = CalculateReward(voterEpoch.VoteWeight, epoch.TotalVotes, epoch.TotalRewards);
                details["pendingReward"] = pendingReward;
            }

            // Calculate vote share
            if (epoch.TotalVotes > 0 && voterEpoch.VoteWeight > 0)
            {
                details["voteShare"] = voterEpoch.VoteWeight * 10000 / epoch.TotalVotes;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();

            stats["currentEpoch"] = CurrentEpoch();
            stats["totalRewardsDistributed"] = TotalRewardsDistributed();
            stats["totalVoters"] = TotalVoters();
            stats["candidateThreshold"] = CandidateThreshold();
            stats["epochDurationSeconds"] = EPOCH_DURATION_SECONDS;
            stats["minVoteWeight"] = MIN_VOTE_WEIGHT;

            // Current epoch info
            BigInteger currentEpochId = CurrentEpoch();
            EpochData currentEpoch = GetEpoch(currentEpochId);
            stats["currentEpochVotes"] = currentEpoch.TotalVotes;
            stats["currentEpochVoters"] = currentEpoch.VoterCount;
            stats["currentEpochRewards"] = currentEpoch.TotalRewards;

            // Platform candidate
            UInt160 candidate = PlatformCandidate();
            if (candidate != null && candidate.IsValid)
            {
                stats["platformCandidate"] = candidate;
            }

            // NeoBurger address
            UInt160 neoburger = NeoBurger();
            if (neoburger != null && neoburger.IsValid)
            {
                stats["neoBurger"] = neoburger;
            }

            return stats;
        }

        [Safe]
        public static Map<string, object> GetVoterEligibility(UInt160 voter)
        {
            Map<string, object> eligibility = new Map<string, object>();

            BigInteger epochId = CurrentEpoch();
            EpochData epoch = GetEpoch(epochId);
            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);

            eligibility["currentEpoch"] = epochId;
            eligibility["epochFinalized"] = epoch.Finalized;
            eligibility["hasVoted"] = voterEpoch.VoteWeight > 0;
            eligibility["currentVoteWeight"] = voterEpoch.VoteWeight;
            eligibility["canVote"] = !epoch.Finalized;
            eligibility["canWithdraw"] = !epoch.Finalized && voterEpoch.VoteWeight > 0;

            // Check delegation
            VoterStats stats = GetVoterStats(voter);
            eligibility["hasDelegation"] = stats.DelegatedTo != UInt160.Zero;
            if (stats.DelegatedTo != UInt160.Zero)
            {
                eligibility["delegatedTo"] = stats.DelegatedTo;
            }

            return eligibility;
        }

        #endregion
    }
}
