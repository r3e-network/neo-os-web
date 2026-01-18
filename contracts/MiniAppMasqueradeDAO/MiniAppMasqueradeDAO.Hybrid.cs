using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMasqueradeDAO
    {
        #region Hybrid Mode - Frontend Voting Power Calculation

        // Reverse delegation index: stores list of delegators for each mask
        private static readonly byte[] PREFIX_DELEGATORS = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_DELEGATOR_COUNT = new byte[] { 0x41 };
        // Cached delegated power for each mask
        private static readonly byte[] PREFIX_CACHED_POWER = new byte[] { 0x42 };

        /// <summary>
        /// Get constants for frontend calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetDAOConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["basicPower"] = 1;
            constants["premiumPower"] = 3;
            constants["founderPower"] = 5;
            constants["totalMasks"] = TotalMasks();
            constants["totalMembers"] = TotalMembers();
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Get mask data for frontend display.
        /// </summary>
        [Safe]
        public static Map<string, object> GetMaskForFrontend(BigInteger maskId)
        {
            MaskData mask = GetMask(maskId);
            Map<string, object> result = new Map<string, object>();

            if (mask.Owner == UInt160.Zero) return result;

            result["id"] = maskId;
            result["owner"] = mask.Owner;
            result["maskType"] = mask.MaskType;
            result["votingPower"] = mask.VotingPower;
            result["reputation"] = mask.Reputation;
            result["active"] = mask.Active;
            result["createdTime"] = mask.CreateTime;

            // Get delegation info
            BigInteger delegatedTo = GetDelegation(maskId);
            result["delegatedTo"] = delegatedTo;

            // Get cached delegated power (O(1) instead of O(n))
            result["cachedDelegatedPower"] = GetCachedDelegatedPower(maskId);

            return result;
        }

        /// <summary>
        /// Get all delegators for a mask (for frontend calculation).
        /// </summary>
        [Safe]
        public static BigInteger[] GetDelegatorsForMask(BigInteger maskId)
        {
            BigInteger count = GetDelegatorCount(maskId);
            BigInteger[] delegators = new BigInteger[(int)count];

            for (BigInteger i = 0; i < count; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_DELEGATORS, (ByteString)maskId.ToByteArray()),
                    (ByteString)i.ToByteArray());
                delegators[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }

            return delegators;
        }

        /// <summary>
        /// Get delegator count for a mask.
        /// </summary>
        [Safe]
        public static BigInteger GetDelegatorCount(BigInteger maskId)
        {
            byte[] key = Helper.Concat(
                PREFIX_DELEGATOR_COUNT,
                (ByteString)maskId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>
        /// Get cached delegated power (O(1) lookup).
        /// </summary>
        [Safe]
        public static BigInteger GetCachedDelegatedPower(BigInteger maskId)
        {
            byte[] key = Helper.Concat(
                PREFIX_CACHED_POWER,
                (ByteString)maskId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        #region Optimized Vote with Cached Power

        /// <summary>
        /// Vote with frontend-calculated effective voting power.
        /// Frontend calculates: basePower + sum of delegator powers.
        /// Contract verifies using cached delegated power (O(1)).
        /// </summary>
        public static void VoteWithCalculation(
            UInt160 voter,
            BigInteger maskId,
            BigInteger proposalId,
            BigInteger choice,
            BigInteger calculatedEffectivePower,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Owner == voter, "not mask owner");
            ExecutionEngine.Assert(mask.Active, "mask inactive");
            ExecutionEngine.Assert(choice >= 1 && choice <= 3, "invalid choice");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(voter), "unauthorized");

            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(proposal.Id > 0, "proposal not found");
            ExecutionEngine.Assert(!proposal.Executed, "proposal executed");
            ExecutionEngine.Assert(Runtime.Time < proposal.EndTime, "voting ended");

            ByteString voteKey = GetVoteKey(proposalId, maskId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voteKey) == null, "already voted");

            ValidatePaymentReceipt(APP_ID, voter, VOTE_FEE, receiptId);

            // O(1) verification of effective voting power
            BigInteger basePower = mask.VotingPower;
            BigInteger cachedDelegatedPower = GetCachedDelegatedPower(maskId);
            BigInteger expectedEffectivePower = basePower + cachedDelegatedPower;

            ExecutionEngine.Assert(calculatedEffectivePower == expectedEffectivePower, "power mismatch");

            VoteData vote = new VoteData
            {
                MaskId = maskId,
                Choice = choice,
                VotingPower = expectedEffectivePower,
                Timestamp = Runtime.Time
            };
            Storage.Put(Storage.CurrentContext, voteKey, StdLib.Serialize(vote));

            if (choice == 1) proposal.YesVotes += expectedEffectivePower;
            else if (choice == 2) proposal.NoVotes += expectedEffectivePower;
            else proposal.AbstainVotes += expectedEffectivePower;
            proposal.TotalVoters += 1;
            StoreProposal(proposalId, proposal);

            mask.VoteCount += 1;
            mask.Reputation += 1;
            StoreMask(maskId, mask);

            UpdateMemberStatsOnVote(mask.Owner, mask.Reputation);

            BigInteger totalVotes = TotalVotes();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTES, totalVotes + 1);

            OnVoteSubmitted(proposalId, maskId, choice);
            OnReputationChanged(maskId, mask.Reputation, "vote submitted");
        }

        /// <summary>
        /// Delegate voting power with cache update.
        /// Updates reverse index and cached power for O(1) lookups.
        /// </summary>
        public static void DelegateWithCacheUpdate(
            UInt160 owner,
            BigInteger maskId,
            BigInteger delegateToMaskId)
        {
            ValidateNotGloballyPaused(APP_ID);

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Owner == owner, "not mask owner");
            ExecutionEngine.Assert(mask.Active, "mask inactive");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            // Get current delegation
            BigInteger currentDelegation = GetDelegation(maskId);

            // Remove from old delegate's cache if exists
            if (currentDelegation > 0 && currentDelegation != delegateToMaskId)
            {
                RemoveDelegatorFromCache(currentDelegation, maskId, mask.VotingPower);
            }

            // Add to new delegate's cache
            if (delegateToMaskId > 0)
            {
                MaskData delegateMask = GetMask(delegateToMaskId);
                ExecutionEngine.Assert(delegateMask.Active, "delegate mask inactive");
                ExecutionEngine.Assert(delegateToMaskId != maskId, "cannot self-delegate");

                AddDelegatorToCache(delegateToMaskId, maskId, mask.VotingPower);
            }

            // Store delegation
            StoreDelegation(maskId, delegateToMaskId);

            OnDelegationChanged(maskId, delegateToMaskId);
        }

        #region Cache Management Helpers

        private static void AddDelegatorToCache(BigInteger targetMaskId, BigInteger delegatorMaskId, BigInteger power)
        {
            // Add to delegators list
            BigInteger count = GetDelegatorCount(targetMaskId);
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_DELEGATORS, (ByteString)targetMaskId.ToByteArray()),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, delegatorMaskId);

            // Update count
            byte[] countKey = Helper.Concat(PREFIX_DELEGATOR_COUNT, (ByteString)targetMaskId.ToByteArray());
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            // Update cached power
            BigInteger currentPower = GetCachedDelegatedPower(targetMaskId);
            byte[] powerKey = Helper.Concat(PREFIX_CACHED_POWER, (ByteString)targetMaskId.ToByteArray());
            Storage.Put(Storage.CurrentContext, powerKey, currentPower + power);
        }

        private static void RemoveDelegatorFromCache(BigInteger targetMaskId, BigInteger delegatorMaskId, BigInteger power)
        {
            // Update cached power (subtract)
            BigInteger currentPower = GetCachedDelegatedPower(targetMaskId);
            byte[] powerKey = Helper.Concat(PREFIX_CACHED_POWER, (ByteString)targetMaskId.ToByteArray());
            BigInteger newPower = currentPower > power ? currentPower - power : 0;
            Storage.Put(Storage.CurrentContext, powerKey, newPower);

            // Note: We don't remove from delegators list to avoid O(n) operation
            // The list may contain stale entries but cached power is accurate
        }

        private static void StoreDelegation(BigInteger maskId, BigInteger delegateToMaskId)
        {
            byte[] key = Helper.Concat(PREFIX_DELEGATIONS, (ByteString)maskId.ToByteArray());
            if (delegateToMaskId > 0)
            {
                Storage.Put(Storage.CurrentContext, key, delegateToMaskId);
            }
            else
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
        }

        #endregion

        #endregion

        #endregion
    }
}
