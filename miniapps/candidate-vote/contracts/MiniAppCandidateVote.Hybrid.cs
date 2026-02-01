using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCandidateVote
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get voting constants for frontend calculations.
        /// Frontend calculates: status, remainingTime, thresholdReached, votesNeeded
        /// </summary>
        [Safe]
        public static Map<string, object> GetVotingConstants()
        {
            Map<string, object> constants = new Map<string, object>();

            constants["epochDurationSeconds"] = EPOCH_DURATION_SECONDS;
            constants["minVoteWeight"] = MIN_VOTE_WEIGHT;
            constants["candidateThreshold"] = CandidateThreshold();
            constants["currentTime"] = Runtime.Time;

            return constants;
        }

        /// <summary>
        /// Get raw epoch data without calculated fields.
        /// Frontend calculates: status, remainingTime, thresholdReached, votesNeeded
        /// </summary>
        [Safe]
        public static Map<string, object> GetEpochRaw(BigInteger epochId)
        {
            EpochData epoch = GetEpoch(epochId);
            Map<string, object> data = new Map<string, object>();
            if (epoch.Id == 0) return data;

            // Raw data only
            data["id"] = epoch.Id;
            data["startTime"] = epoch.StartTime;
            data["endTime"] = epoch.EndTime;
            data["totalVotes"] = epoch.TotalVotes;
            data["totalRewards"] = epoch.TotalRewards;
            data["voterCount"] = epoch.VoterCount;
            data["strategy"] = epoch.Strategy;
            data["finalized"] = epoch.Finalized;
            data["rewardsClaimed"] = epoch.RewardsClaimed;

            // Constants for frontend calculation
            data["threshold"] = CandidateThreshold();
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Get raw voter epoch data without calculated fields.
        /// Frontend calculates: pendingReward, voteShare
        /// </summary>
        [Safe]
        public static Map<string, object> GetVoterEpochRaw(UInt160 voter, BigInteger epochId)
        {
            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);
            EpochData epoch = GetEpoch(epochId);
            Map<string, object> data = new Map<string, object>();

            // Raw voter data
            data["voteWeight"] = voterEpoch.VoteWeight;
            data["delegatedWeight"] = voterEpoch.DelegatedWeight;
            data["rewardsClaimed"] = voterEpoch.RewardsClaimed;
            data["voteTime"] = voterEpoch.VoteTime;
            data["claimed"] = voterEpoch.Claimed;

            // Raw epoch data for frontend calculation
            data["epochTotalVotes"] = epoch.TotalVotes;
            data["epochTotalRewards"] = epoch.TotalRewards;
            data["epochFinalized"] = epoch.Finalized;

            return data;
        }

        /// <summary>
        /// Get raw platform stats without calculated fields.
        /// </summary>
        [Safe]
        public static Map<string, object> GetPlatformStatsRaw()
        {
            Map<string, object> stats = new Map<string, object>();

            stats["currentEpoch"] = CurrentEpoch();
            stats["totalRewardsDistributed"] = TotalRewardsDistributed();
            stats["totalVoters"] = TotalVoters();
            stats["candidateThreshold"] = CandidateThreshold();
            stats["epochDurationSeconds"] = EPOCH_DURATION_SECONDS;
            stats["minVoteWeight"] = MIN_VOTE_WEIGHT;

            BigInteger currentEpochId = CurrentEpoch();
            EpochData currentEpoch = GetEpoch(currentEpochId);
            stats["currentEpochVotes"] = currentEpoch.TotalVotes;
            stats["currentEpochVoters"] = currentEpoch.VoterCount;
            stats["currentEpochRewards"] = currentEpoch.TotalRewards;

            UInt160 candidate = PlatformCandidate();
            if (candidate != null && candidate.IsValid)
            {
                stats["platformCandidate"] = candidate;
            }

            return stats;
        }

        /// <summary>
        /// Get raw voter eligibility data.
        /// Frontend calculates: canVote, canWithdraw
        /// </summary>
        [Safe]
        public static Map<string, object> GetVoterEligibilityRaw(UInt160 voter)
        {
            Map<string, object> data = new Map<string, object>();

            BigInteger epochId = CurrentEpoch();
            EpochData epoch = GetEpoch(epochId);
            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);

            data["currentEpoch"] = epochId;
            data["epochFinalized"] = epoch.Finalized;
            data["currentVoteWeight"] = voterEpoch.VoteWeight;

            VoterStats stats = GetVoterStats(voter);
            data["hasDelegation"] = stats.DelegatedTo != UInt160.Zero;
            if (stats.DelegatedTo != UInt160.Zero)
            {
                data["delegatedTo"] = stats.DelegatedTo;
            }

            return data;
        }

        #endregion
    }
}