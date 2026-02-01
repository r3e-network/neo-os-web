using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCandidateVote
    {
        #region Internal Helpers
        private static readonly byte[] EPOCH_FIELD_ID = new byte[] { 0x01 };
        private static readonly byte[] EPOCH_FIELD_START_TIME = new byte[] { 0x02 };
        private static readonly byte[] EPOCH_FIELD_END_TIME = new byte[] { 0x03 };
        private static readonly byte[] EPOCH_FIELD_TOTAL_VOTES = new byte[] { 0x04 };
        private static readonly byte[] EPOCH_FIELD_TOTAL_REWARDS = new byte[] { 0x05 };
        private static readonly byte[] EPOCH_FIELD_VOTER_COUNT = new byte[] { 0x06 };
        private static readonly byte[] EPOCH_FIELD_STRATEGY = new byte[] { 0x07 };
        private static readonly byte[] EPOCH_FIELD_FINALIZED = new byte[] { 0x08 };
        private static readonly byte[] EPOCH_FIELD_REWARDS_CLAIMED = new byte[] { 0x09 };

        private static readonly byte[] VOTER_STATS_FIELD_TOTAL_VOTED = new byte[] { 0x01 };
        private static readonly byte[] VOTER_STATS_FIELD_EPOCHS_PARTICIPATED = new byte[] { 0x02 };
        private static readonly byte[] VOTER_STATS_FIELD_TOTAL_REWARDS = new byte[] { 0x03 };
        private static readonly byte[] VOTER_STATS_FIELD_HIGHEST_VOTE = new byte[] { 0x04 };
        private static readonly byte[] VOTER_STATS_FIELD_BADGE_COUNT = new byte[] { 0x05 };
        private static readonly byte[] VOTER_STATS_FIELD_JOIN_TIME = new byte[] { 0x06 };
        private static readonly byte[] VOTER_STATS_FIELD_LAST_VOTE = new byte[] { 0x07 };
        private static readonly byte[] VOTER_STATS_FIELD_DELEGATED_TO = new byte[] { 0x08 };

        private static readonly byte[] VOTER_EPOCH_FIELD_VOTE_WEIGHT = new byte[] { 0x01 };
        private static readonly byte[] VOTER_EPOCH_FIELD_DELEGATED_WEIGHT = new byte[] { 0x02 };
        private static readonly byte[] VOTER_EPOCH_FIELD_REWARDS = new byte[] { 0x03 };
        private static readonly byte[] VOTER_EPOCH_FIELD_VOTE_TIME = new byte[] { 0x04 };
        private static readonly byte[] VOTER_EPOCH_FIELD_CLAIMED = new byte[] { 0x05 };

        private static byte[] GetEpochKey(BigInteger epochId) =>
            Helper.Concat(PREFIX_EPOCHS, (ByteString)epochId.ToByteArray());

        private static byte[] GetVoterStatsKey(UInt160 voter) =>
            Helper.Concat(PREFIX_VOTER_STATS, voter);

        private static byte[] GetVoterEpochKey(UInt160 voter, BigInteger epochId) =>
            Helper.Concat(Helper.Concat(PREFIX_VOTER_EPOCH, voter), (ByteString)epochId.ToByteArray());

        private static BigInteger GetBigInteger(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        private static UInt160 GetUInt160(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        private static string GetString(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? string.Empty : (string)data;
        }

        private static bool GetBool(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data != 0;
        }

        private static void PutBool(byte[] key, bool value)
        {
            Storage.Put(Storage.CurrentContext, key, value ? 1 : 0);
        }

        private static void StoreEpoch(BigInteger epochId, EpochData epoch)
        {
            byte[] key = GetEpochKey(epochId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_ID), epoch.Id);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_START_TIME), epoch.StartTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_END_TIME), epoch.EndTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_TOTAL_VOTES), epoch.TotalVotes);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_TOTAL_REWARDS), epoch.TotalRewards);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_VOTER_COUNT), epoch.VoterCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_STRATEGY), epoch.Strategy);
            PutBool(Helper.Concat(key, EPOCH_FIELD_FINALIZED), epoch.Finalized);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, EPOCH_FIELD_REWARDS_CLAIMED), epoch.RewardsClaimed);
        }

        private static void StoreVoterStats(UInt160 voter, VoterStats stats)
        {
            byte[] key = GetVoterStatsKey(voter);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_TOTAL_VOTED), stats.TotalVoted);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_EPOCHS_PARTICIPATED), stats.EpochsParticipated);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_TOTAL_REWARDS), stats.TotalRewardsClaimed);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_HIGHEST_VOTE), stats.HighestVote);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_BADGE_COUNT), stats.BadgeCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_JOIN_TIME), stats.JoinTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_LAST_VOTE), stats.LastVoteTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_STATS_FIELD_DELEGATED_TO), stats.DelegatedTo);
        }

        [Safe]
        public static VoterEpochData GetVoterEpochData(UInt160 voter, BigInteger epochId)
        {
            byte[] key = GetVoterEpochKey(voter, epochId);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, VOTER_EPOCH_FIELD_VOTE_WEIGHT));
            if (data == null) return new VoterEpochData();

            return new VoterEpochData
            {
                VoteWeight = GetBigInteger(Helper.Concat(key, VOTER_EPOCH_FIELD_VOTE_WEIGHT)),
                DelegatedWeight = GetBigInteger(Helper.Concat(key, VOTER_EPOCH_FIELD_DELEGATED_WEIGHT)),
                RewardsClaimed = GetBigInteger(Helper.Concat(key, VOTER_EPOCH_FIELD_REWARDS)),
                VoteTime = GetBigInteger(Helper.Concat(key, VOTER_EPOCH_FIELD_VOTE_TIME)),
                Claimed = GetBool(Helper.Concat(key, VOTER_EPOCH_FIELD_CLAIMED))
            };
        }

        private static void StoreVoterEpochData(UInt160 voter, BigInteger epochId, VoterEpochData data)
        {
            byte[] key = GetVoterEpochKey(voter, epochId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_EPOCH_FIELD_VOTE_WEIGHT), data.VoteWeight);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_EPOCH_FIELD_DELEGATED_WEIGHT), data.DelegatedWeight);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_EPOCH_FIELD_REWARDS), data.RewardsClaimed);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, VOTER_EPOCH_FIELD_VOTE_TIME), data.VoteTime);
            PutBool(Helper.Concat(key, VOTER_EPOCH_FIELD_CLAIMED), data.Claimed);
        }

        private static BigInteger CalculateReward(BigInteger voteWeight, BigInteger totalVotes, BigInteger totalRewards)
        {
            if (totalVotes == 0 || totalRewards == 0) return 0;
            return voteWeight * totalRewards / totalVotes;
        }

        private static void UpdateVoterStatsOnVote(UInt160 voter, BigInteger voteWeight, bool isNewVoter)
        {
            VoterStats stats = GetVoterStats(voter);

            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalVoters = TotalVoters();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTERS, totalVoters + 1);
            }

            if (isNewVoter)
            {
                stats.EpochsParticipated += 1;
            }

            stats.TotalVoted += voteWeight;
            stats.LastVoteTime = Runtime.Time;

            if (voteWeight > stats.HighestVote)
            {
                stats.HighestVote = voteWeight;
            }

            StoreVoterStats(voter, stats);
        }

        private static void UpdateVoterStatsOnClaim(UInt160 voter, BigInteger reward)
        {
            VoterStats stats = GetVoterStats(voter);
            stats.TotalRewardsClaimed += reward;
            StoreVoterStats(voter, stats);
        }

        #endregion
    }
}
