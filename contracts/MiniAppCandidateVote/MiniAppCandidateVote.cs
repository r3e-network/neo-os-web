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
    public delegate void VoteRegisteredHandler(UInt160 voter, BigInteger epochId, BigInteger voteWeight);
    public delegate void RewardsDepositedHandler(BigInteger epochId, BigInteger amount);
    public delegate void RewardsClaimedHandler(UInt160 voter, BigInteger epochId, BigInteger amount);
    public delegate void EpochAdvancedHandler(BigInteger oldEpoch, BigInteger newEpoch);
    public delegate void StrategyChangedHandler(BigInteger epochId, string strategy, BigInteger totalVotes);

    [DisplayName("MiniAppCandidateVote")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Vote for platform candidate and earn proportional GAS rewards")]
    [ContractPermission("*", "*")]
    public class MiniAppCandidateVote : SmartContract
    {
        private const string APP_ID = "miniapp-candidate-vote";
        private const long EPOCH_DURATION = 604800000;
        private const long MIN_VOTE_WEIGHT = 100000000;

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_CANDIDATE = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_EPOCH_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_EPOCH_START = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_EPOCH_REWARDS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_EPOCH_TOTAL_VOTES = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_VOTER_WEIGHT = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_VOTER_CLAIMED = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_CANDIDATE_THRESHOLD = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_NEOBURGER = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_EPOCH_STRATEGY = new byte[] { 0x32 };

        private const string STRATEGY_SELF = "self";
        private const string STRATEGY_NEOBURGER = "neoburger";

        [DisplayName("VoteRegistered")]
        public static event VoteRegisteredHandler OnVoteRegistered;
        [DisplayName("RewardsDeposited")]
        public static event RewardsDepositedHandler OnRewardsDeposited;
        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed;
        [DisplayName("EpochAdvanced")]
        public static event EpochAdvancedHandler OnEpochAdvanced;
        [DisplayName("StrategyChanged")]
        public static event StrategyChangedHandler OnStrategyChanged;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_ID, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_START, Runtime.Time);
        }

        [Safe]
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        [Safe]
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        [Safe]
        public static UInt160 PlatformCandidate() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_CANDIDATE);
        [Safe]
        public static BigInteger CurrentEpoch() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EPOCH_ID);
        [Safe]
        public static BigInteger EpochStartTime() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EPOCH_START);
        [Safe]
        public static BigInteger EpochEndTime() => EpochStartTime() + EPOCH_DURATION;

        public static void SetGateway(UInt160 gateway)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static void SetPlatformCandidate(UInt160 candidate)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_CANDIDATE, candidate);
        }

        public static void SetCandidateThreshold(BigInteger threshold)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_CANDIDATE_THRESHOLD, threshold);
        }

        public static void SetNeoBurger(UInt160 neoburger)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            Storage.Put(Storage.CurrentContext, PREFIX_NEOBURGER, neoburger);
        }

        [Safe]
        public static BigInteger CandidateThreshold()
        {
            var data = Storage.Get(Storage.CurrentContext, PREFIX_CANDIDATE_THRESHOLD);
            return data == null ? 500000000000 : (BigInteger)data; // Default 5000 NEO
        }

        [Safe]
        public static UInt160 NeoBurger()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_NEOBURGER);
        }

        [Safe]
        public static string EpochStrategy(BigInteger epochId)
        {
            var key = Helper.Concat((ByteString)PREFIX_EPOCH_STRATEGY, (ByteString)epochId.ToByteArray());
            var data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? STRATEGY_NEOBURGER : (string)data;
        }

        [Safe]
        public static string CurrentStrategy()
        {
            return EpochStrategy(CurrentEpoch());
        }

        [Safe]
        public static BigInteger EpochRewards(BigInteger epochId)
        {
            var key = Helper.Concat((ByteString)PREFIX_EPOCH_REWARDS, (ByteString)epochId.ToByteArray());
            var data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger EpochTotalVotes(BigInteger epochId)
        {
            var key = Helper.Concat((ByteString)PREFIX_EPOCH_TOTAL_VOTES, (ByteString)epochId.ToByteArray());
            var data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        public static void AdvanceEpoch()
        {
            ExecutionEngine.Assert(Runtime.Time >= EpochEndTime(), "epoch not ended");
            BigInteger oldEpoch = CurrentEpoch();
            BigInteger newEpoch = oldEpoch + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_ID, newEpoch);
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_START, Runtime.Time);

            // Determine strategy for new epoch based on total votes
            BigInteger totalVotes = EpochTotalVotes(oldEpoch);
            string strategy = totalVotes >= CandidateThreshold() ? STRATEGY_SELF : STRATEGY_NEOBURGER;

            var strategyKey = Helper.Concat((ByteString)PREFIX_EPOCH_STRATEGY, (ByteString)newEpoch.ToByteArray());
            Storage.Put(Storage.CurrentContext, strategyKey, strategy);

            OnEpochAdvanced(oldEpoch, newEpoch);
            OnStrategyChanged(newEpoch, strategy, totalVotes);
        }

        public static void RegisterVote(UInt160 voter, BigInteger voteWeight)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(voteWeight >= MIN_VOTE_WEIGHT, "min 1 NEO");

            BigInteger epochId = CurrentEpoch();
            var voterKey = GetVoterKey(voter, epochId);
            var existingWeight = Storage.Get(Storage.CurrentContext, voterKey);

            if (existingWeight != null)
            {
                BigInteger oldWeight = (BigInteger)existingWeight;
                UpdateTotalVotes(epochId, -oldWeight);
            }

            Storage.Put(Storage.CurrentContext, voterKey, voteWeight);
            UpdateTotalVotes(epochId, voteWeight);
            OnVoteRegistered(voter, epochId, voteWeight);
        }

        public static void DepositRewards(BigInteger epochId, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "admin only");
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            var key = Helper.Concat((ByteString)PREFIX_EPOCH_REWARDS, (ByteString)epochId.ToByteArray());
            BigInteger current = EpochRewards(epochId);
            Storage.Put(Storage.CurrentContext, key, current + amount);
            OnRewardsDeposited(epochId, amount);
        }

        public static void ClaimRewards(UInt160 voter, BigInteger epochId)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(epochId < CurrentEpoch(), "epoch not ended");

            var claimedKey = GetClaimedKey(voter, epochId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, claimedKey) == null, "already claimed");

            BigInteger reward = GetPendingRewards(voter, epochId);
            ExecutionEngine.Assert(reward > 0, "no rewards");

            Storage.Put(Storage.CurrentContext, claimedKey, 1);

            bool success = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, voter, reward, null);
            ExecutionEngine.Assert(success, "transfer failed");

            OnRewardsClaimed(voter, epochId, reward);
        }

        [Safe]
        public static BigInteger GetVoterWeight(UInt160 voter, BigInteger epochId)
        {
            var key = GetVoterKey(voter, epochId);
            var data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger GetPendingRewards(UInt160 voter, BigInteger epochId)
        {
            BigInteger voterWeight = GetVoterWeight(voter, epochId);
            if (voterWeight == 0) return 0;

            BigInteger totalVotes = EpochTotalVotes(epochId);
            if (totalVotes == 0) return 0;

            BigInteger rewards = EpochRewards(epochId);
            return (rewards * voterWeight) / totalVotes;
        }

        [Safe]
        public static bool HasClaimed(UInt160 voter, BigInteger epochId)
        {
            var key = GetClaimedKey(voter, epochId);
            return Storage.Get(Storage.CurrentContext, key) != null;
        }

        private static ByteString GetVoterKey(UInt160 voter, BigInteger epochId)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER_WEIGHT, (ByteString)(byte[])voter),
                (ByteString)epochId.ToByteArray());
        }

        private static ByteString GetClaimedKey(UInt160 voter, BigInteger epochId)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER_CLAIMED, (ByteString)(byte[])voter),
                (ByteString)epochId.ToByteArray());
        }

        private static void UpdateTotalVotes(BigInteger epochId, BigInteger delta)
        {
            var key = Helper.Concat((ByteString)PREFIX_EPOCH_TOTAL_VOTES, (ByteString)epochId.ToByteArray());
            BigInteger current = EpochTotalVotes(epochId);
            Storage.Put(Storage.CurrentContext, key, current + delta);
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                // Accept GAS deposits for rewards
            }
        }
    }
}
