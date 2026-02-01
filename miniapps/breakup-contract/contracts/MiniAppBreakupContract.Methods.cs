using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBreakupContract
    {
        #region User-Facing Methods

        /// <summary>
        /// Create a new commitment contract with title and terms.
        /// Party1 initiates and stakes first, Party2 must sign within deadline.
        /// </summary>
        public static BigInteger CreateContract(
            UInt160 party1,
            UInt160 party2,
            BigInteger stake,
            BigInteger durationDays,
            string title,
            string terms,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(party1.IsValid && party2.IsValid, "invalid address");
            ExecutionEngine.Assert(party1 != party2, "cannot contract with self");
            ExecutionEngine.Assert(stake >= MIN_STAKE && stake <= MAX_STAKE, "stake out of range");
            ExecutionEngine.Assert(durationDays >= MIN_DURATION_DAYS && durationDays <= MAX_DURATION_DAYS, "duration out of range");
            ExecutionEngine.Assert(title.Length > 0 && title.Length <= 100, "invalid title");
            ExecutionEngine.Assert(terms.Length <= 2000, "terms too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(party1), "unauthorized");

            ValidatePaymentReceipt(APP_ID, party1, stake, receiptId);

            BigInteger contractId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CONTRACT_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CONTRACT_ID, contractId);

            RelationshipContract contract = new RelationshipContract
            {
                Party1 = party1,
                Party2 = party2,
                Stake = stake,
                Party1Signed = true,
                Party2Signed = false,
                CreatedTime = Runtime.Time,
                StartTime = 0,
                Duration = durationDays * 86400,
                SignDeadline = Runtime.Time + SIGN_DEADLINE_SECONDS,
                Active = false,
                Completed = false,
                Cancelled = false,
                Title = title,
                Terms = terms,
                MilestonesReached = 0,
                TotalPenaltyPaid = 0,
                BreakupInitiator = UInt160.Zero
            };
            StoreContract(contractId, contract);

            AddUserContract(party1, contractId);
            AddUserContract(party2, contractId);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked + stake);

            OnContractCreated(contractId, party1, party2, stake);
            return contractId;
        }

        /// <summary>
        /// Party2 signs the contract and stakes their GAS.
        /// </summary>
        public static void SignContract(BigInteger contractId, UInt160 party, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Party1 != UInt160.Zero, "contract not found");
            ExecutionEngine.Assert(contract.Party2 == party, "not party2");
            ExecutionEngine.Assert(!contract.Party2Signed, "already signed");
            ExecutionEngine.Assert(!contract.Cancelled, "contract cancelled");
            ExecutionEngine.Assert(Runtime.Time <= contract.SignDeadline, "sign deadline passed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(party), "unauthorized");

            ValidatePaymentReceipt(APP_ID, party, contract.Stake, receiptId);

            contract.Party2Signed = true;
            contract.Active = true;
            contract.StartTime = Runtime.Time;
            StoreContract(contractId, contract);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked + contract.Stake);

            OnContractSigned(contractId, party);
        }

        /// <summary>
        /// Cancel unsigned contract. Only party1 can cancel before party2 signs.
        /// </summary>
        public static void CancelContract(BigInteger contractId, UInt160 canceller)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(canceller), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Party1 != UInt160.Zero, "contract not found");
            ExecutionEngine.Assert(contract.Party1 == canceller, "only party1 can cancel");
            ExecutionEngine.Assert(!contract.Party2Signed, "already signed by both");
            ExecutionEngine.Assert(!contract.Cancelled, "already cancelled");

            contract.Cancelled = true;
            StoreContract(contractId, contract);

            DistributeFunds(contractId, contract.Party1, contract.Stake);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked - contract.Stake);

            OnContractCancelled(contractId, canceller);
        }

        /// <summary>
        /// Request mutual breakup. Both parties must agree for full refund.
        /// </summary>
        public static void RequestMutualBreakup(BigInteger contractId, UInt160 requester)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(requester), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");
            ExecutionEngine.Assert(requester == contract.Party1 || requester == contract.Party2, "not a party");

            MutualBreakupRequest existing = GetMutualBreakupRequest(contractId);
            ExecutionEngine.Assert(existing.Requester == UInt160.Zero, "request already pending");

            MutualBreakupRequest request = new MutualBreakupRequest
            {
                Requester = requester,
                RequestTime = Runtime.Time,
                Confirmed = false
            };
            StoreMutualBreakupRequest(contractId, request);

            OnMutualBreakupRequested(contractId, requester);
        }

        /// <summary>
        /// Confirm mutual breakup request. Must be called by the other party.
        /// </summary>
        public static void ConfirmMutualBreakup(BigInteger contractId, UInt160 confirmer)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(confirmer), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");
            ExecutionEngine.Assert(confirmer == contract.Party1 || confirmer == contract.Party2, "not a party");

            MutualBreakupRequest request = GetMutualBreakupRequest(contractId);
            ExecutionEngine.Assert(request.Requester != UInt160.Zero, "no pending request");
            ExecutionEngine.Assert(request.Requester != confirmer, "cannot confirm own request");
            ExecutionEngine.Assert(Runtime.Time <= request.RequestTime + MUTUAL_BREAKUP_COOLDOWN_SECONDS, "request expired");

            contract.Active = false;
            contract.Completed = true;
            StoreContract(contractId, contract);

            DistributeFunds(contractId, contract.Party1, contract.Stake);
            DistributeFunds(contractId, contract.Party2, contract.Stake);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked - (contract.Stake * 2));
            BigInteger totalCompleted = TotalCompleted();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COMPLETED, totalCompleted + 1);

            DeleteMutualBreakupRequest(contractId);

            OnMutualBreakupConfirmed(contractId);
            OnContractCompleted(contractId, true);
        }

        /// <summary>
        /// Unilateral breakup - initiator pays penalty to loyal party.
        /// </summary>
        public static void TriggerBreakup(BigInteger contractId, UInt160 initiator)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(initiator), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");
            ExecutionEngine.Assert(initiator == contract.Party1 || initiator == contract.Party2, "not a party");

            BigInteger elapsed = Runtime.Time - contract.StartTime;
            BigInteger remaining = contract.Duration - elapsed;
            if (remaining < 0) remaining = 0;

            BigInteger penalty = contract.Stake * remaining / contract.Duration;
            BigInteger initiatorRefund = contract.Stake - penalty;
            BigInteger loyalPartyReward = contract.Stake + penalty;

            UInt160 loyalParty = initiator == contract.Party1 ? contract.Party2 : contract.Party1;

            contract.Active = false;
            contract.Completed = true;
            contract.BreakupInitiator = initiator;
            contract.TotalPenaltyPaid = penalty;
            StoreContract(contractId, contract);

            if (initiatorRefund > 0)
            {
                DistributeFunds(contractId, initiator, initiatorRefund);
            }
            DistributeFunds(contractId, loyalParty, loyalPartyReward);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked - (contract.Stake * 2));
            BigInteger totalBroken = TotalBroken();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BROKEN, totalBroken + 1);

            OnBreakupTriggered(contractId, initiator, penalty);
            OnContractCompleted(contractId, false);
        }

        /// <summary>
        /// Claim milestone reward at 25%, 50%, 75% completion.
        /// </summary>
        public static void ClaimMilestone(BigInteger contractId, UInt160 claimer)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");
            ExecutionEngine.Assert(claimer == contract.Party1 || claimer == contract.Party2, "not a party");

            BigInteger elapsed = Runtime.Time - contract.StartTime;
            BigInteger progressPercent = elapsed * 100 / contract.Duration;

            BigInteger nextMilestone = contract.MilestonesReached + 1;
            BigInteger requiredProgress = nextMilestone * 25;

            ExecutionEngine.Assert(nextMilestone <= 3, "all milestones claimed");
            ExecutionEngine.Assert(progressPercent >= requiredProgress, "milestone not reached");

            BigInteger rewardPool = RewardPool();
            BigInteger reward = rewardPool * 1 / 100;
            if (reward > rewardPool) reward = rewardPool;

            contract.MilestonesReached = nextMilestone;
            StoreContract(contractId, contract);

            if (reward > 0)
            {
                BigInteger halfReward = reward / 2;
                Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, rewardPool - reward);
                DistributeFunds(contractId, contract.Party1, halfReward);
                DistributeFunds(contractId, contract.Party2, halfReward);
            }

            OnMilestoneReached(contractId, nextMilestone, reward);
        }

        /// <summary>
        /// Complete contract after full duration. Both parties get stake + bonus.
        /// </summary>
        public static void CompleteContract(BigInteger contractId)
        {
            ValidateNotGloballyPaused(APP_ID);

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");

            BigInteger elapsed = Runtime.Time - contract.StartTime;
            ExecutionEngine.Assert(elapsed >= contract.Duration, "contract not yet complete");

            contract.Active = false;
            contract.Completed = true;
            StoreContract(contractId, contract);

            BigInteger bonus = contract.Stake * COMPLETION_BONUS_BPS / 10000;
            BigInteger rewardPool = RewardPool();
            if (bonus > rewardPool) bonus = rewardPool;

            BigInteger party1Amount = contract.Stake + (bonus / 2);
            BigInteger party2Amount = contract.Stake + (bonus / 2);

            DistributeFunds(contractId, contract.Party1, party1Amount);
            DistributeFunds(contractId, contract.Party2, party2Amount);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked - (contract.Stake * 2));
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, rewardPool - bonus);
            BigInteger totalCompleted = TotalCompleted();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COMPLETED, totalCompleted + 1);

            OnContractCompleted(contractId, false);
        }

        /// <summary>
        /// Renew contract with additional duration and optional stake increase.
        /// </summary>
        public static void RenewContract(
            BigInteger contractId,
            BigInteger additionalDays,
            BigInteger additionalStake,
            BigInteger receiptId1,
            BigInteger receiptId2)
        {
            ValidateNotGloballyPaused(APP_ID);

            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Active, "contract not active");
            ExecutionEngine.Assert(additionalDays >= 30, "min 30 days extension");

            ExecutionEngine.Assert(Runtime.CheckWitness(contract.Party1), "party1 must sign");
            ExecutionEngine.Assert(Runtime.CheckWitness(contract.Party2), "party2 must sign");

            if (additionalStake > 0)
            {
                ValidatePaymentReceipt(APP_ID, contract.Party1, additionalStake, receiptId1);
                ValidatePaymentReceipt(APP_ID, contract.Party2, additionalStake, receiptId2);
                contract.Stake += additionalStake;

                BigInteger totalStaked = TotalStaked();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked + (additionalStake * 2));
            }

            contract.Duration += additionalDays * 86400;
            StoreContract(contractId, contract);

            OnContractRenewed(contractId, additionalDays * 86400, additionalStake * 2);
        }

        #endregion

        #region Admin Methods

        /// <summary>
        /// Add funds to the reward pool (admin or anyone can contribute).
        /// </summary>
        public static void ContributeToRewardPool(UInt160 contributor, BigInteger amount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(contributor), "unauthorized");

            ValidatePaymentReceipt(APP_ID, contributor, amount, receiptId);

            BigInteger pool = RewardPool();
            Storage.Put(Storage.CurrentContext, PREFIX_REWARD_POOL, pool + amount);
        }

        /// <summary>
        /// Process expired unsigned contracts (automation or admin).
        /// </summary>
        public static void ProcessExpiredContract(BigInteger contractId)
        {
            RelationshipContract contract = GetContract(contractId);
            ExecutionEngine.Assert(contract.Party1 != UInt160.Zero, "contract not found");
            ExecutionEngine.Assert(!contract.Party2Signed, "already signed");
            ExecutionEngine.Assert(!contract.Cancelled, "already cancelled");
            ExecutionEngine.Assert(Runtime.Time > contract.SignDeadline, "not expired");

            contract.Cancelled = true;
            StoreContract(contractId, contract);

            DistributeFunds(contractId, contract.Party1, contract.Stake);

            BigInteger totalStaked = TotalStaked();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_STAKED, totalStaked - contract.Stake);

            OnContractCancelled(contractId, UInt160.Zero);
        }

        #endregion

        #region Automation

        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            if (payload != null && payload.Length > 0)
            {
                BigInteger[] contractIds = (BigInteger[])StdLib.Deserialize(payload);
                foreach (BigInteger contractId in contractIds)
                {
                    try
                    {
                        ProcessExpiredContract(contractId);
                    }
                    catch { }
                }
            }
        }

        #endregion
    }
}
