using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCandidateVote
    {
        #region Admin Methods

        public static void SetPlatformCandidate(UInt160 candidate)
        {
            ValidateAdmin();
            ValidateAddress(candidate);
            Storage.Put(Storage.CurrentContext, PREFIX_CANDIDATE, candidate);
        }

        public static void SetCandidateThreshold(BigInteger threshold)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(threshold > 0, "invalid threshold");
            Storage.Put(Storage.CurrentContext, PREFIX_THRESHOLD, threshold);
        }

        public static void SetNeoBurger(UInt160 neoburger)
        {
            ValidateAdmin();
            ValidateAddress(neoburger);
            Storage.Put(Storage.CurrentContext, PREFIX_NEOBURGER, neoburger);
        }

        public static void DepositRewards(BigInteger epochId, BigInteger amount)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            EpochData epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(epoch.Id > 0, "epoch not found");

            epoch.TotalRewards += amount;
            StoreEpoch(epochId, epoch);

            OnRewardsDeposited(epochId, amount);
        }

        #endregion

        #region User Methods

        /// <summary>
        /// Register vote for current epoch.
        /// </summary>
        public static void RegisterVote(UInt160 voter, BigInteger voteWeight)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(voteWeight >= MIN_VOTE_WEIGHT, "min 1 NEO");

            BigInteger epochId = CurrentEpoch();
            EpochData epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(!epoch.Finalized, "epoch finalized");

            // Get existing vote
            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);
            BigInteger oldWeight = voterEpoch.VoteWeight;

            // Update epoch totals
            epoch.TotalVotes = epoch.TotalVotes - oldWeight + voteWeight;
            if (oldWeight == 0) epoch.VoterCount += 1;
            StoreEpoch(epochId, epoch);

            // Update voter epoch data
            voterEpoch.VoteWeight = voteWeight;
            voterEpoch.VoteTime = Runtime.Time;
            StoreVoterEpochData(voter, epochId, voterEpoch);

            // Update voter stats
            UpdateVoterStatsOnVote(voter, voteWeight, oldWeight == 0);

            // Check badges
            CheckVoterBadges(voter);

            OnVoteRegistered(voter, epochId, voteWeight);
        }

        /// <summary>
        /// Withdraw vote from current epoch.
        /// </summary>
        public static void WithdrawVote(UInt160 voter)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");

            BigInteger epochId = CurrentEpoch();
            EpochData epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(!epoch.Finalized, "epoch finalized");

            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);
            ExecutionEngine.Assert(voterEpoch.VoteWeight > 0, "no vote to withdraw");

            BigInteger withdrawnWeight = voterEpoch.VoteWeight;

            // Update epoch
            epoch.TotalVotes -= withdrawnWeight;
            epoch.VoterCount -= 1;
            StoreEpoch(epochId, epoch);

            // Clear voter epoch data
            voterEpoch.VoteWeight = 0;
            StoreVoterEpochData(voter, epochId, voterEpoch);

            OnVoteWithdrawn(voter, epochId, withdrawnWeight);
        }

        /// <summary>
        /// Advance to next epoch.
        /// </summary>
        public static void AdvanceEpoch()
        {
            BigInteger currentEpochId = CurrentEpoch();
            EpochData currentEpoch = GetEpoch(currentEpochId);
            ExecutionEngine.Assert(Runtime.Time >= currentEpoch.EndTime, "epoch not ended");

            // Finalize current epoch
            currentEpoch.Finalized = true;
            string strategy = currentEpoch.TotalVotes >= CandidateThreshold() ? STRATEGY_SELF : STRATEGY_NEOBURGER;
            currentEpoch.Strategy = strategy;
            StoreEpoch(currentEpochId, currentEpoch);

            // Create new epoch
            BigInteger newEpochId = currentEpochId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_EPOCH_ID, newEpochId);

            EpochData newEpoch = new EpochData
            {
                Id = newEpochId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + EPOCH_DURATION_SECONDS,
                TotalVotes = 0,
                TotalRewards = 0,
                VoterCount = 0,
                Strategy = STRATEGY_NEOBURGER,
                Finalized = false,
                RewardsClaimed = 0
            };
            StoreEpoch(newEpochId, newEpoch);

            OnEpochAdvanced(currentEpochId, newEpochId);
            OnStrategyChanged(currentEpochId, strategy, currentEpoch.TotalVotes);
        }

        /// <summary>
        /// Claim rewards from a past epoch.
        /// </summary>
        public static void ClaimRewards(UInt160 voter, BigInteger epochId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(epochId < CurrentEpoch(), "epoch not ended");

            EpochData epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(epoch.Finalized, "epoch not finalized");

            VoterEpochData voterEpoch = GetVoterEpochData(voter, epochId);
            ExecutionEngine.Assert(!voterEpoch.Claimed, "already claimed");
            ExecutionEngine.Assert(voterEpoch.VoteWeight > 0, "no vote in epoch");

            BigInteger reward = CalculateReward(voterEpoch.VoteWeight, epoch.TotalVotes, epoch.TotalRewards);
            ExecutionEngine.Assert(reward > 0, "no rewards");

            // Mark as claimed
            voterEpoch.Claimed = true;
            voterEpoch.RewardsClaimed = reward;
            StoreVoterEpochData(voter, epochId, voterEpoch);

            // Update epoch claimed amount
            epoch.RewardsClaimed += reward;
            StoreEpoch(epochId, epoch);

            // Update voter stats
            UpdateVoterStatsOnClaim(voter, reward);

            // Update global stats
            BigInteger totalRewards = TotalRewardsDistributed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDS, totalRewards + reward);

            // Transfer GAS
            bool success = GAS.Transfer(Runtime.ExecutingScriptHash, voter, reward);
            ExecutionEngine.Assert(success, "transfer failed");

            OnRewardsClaimed(voter, epochId, reward);
        }

        /// <summary>
        /// Delegate voting power to another user.
        /// </summary>
        public static void DelegateVote(UInt160 delegator, UInt160 delegatee)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(delegator), "unauthorized");
            ExecutionEngine.Assert(delegator != delegatee, "cannot self-delegate");

            if (delegatee != UInt160.Zero)
            {
                ValidateAddress(delegatee);
            }

            VoterStats stats = GetVoterStats(delegator);
            stats.DelegatedTo = delegatee;
            StoreVoterStats(delegator, stats);

            OnDelegationChanged(delegator, delegatee, CurrentEpoch());
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            // Auto-advance epoch if ended
            BigInteger currentEpochId = CurrentEpoch();
            EpochData currentEpoch = GetEpoch(currentEpochId);

            if (Runtime.Time >= currentEpoch.EndTime && !currentEpoch.Finalized)
            {
                AdvanceEpoch();
            }
        }

        #endregion
    }
}
