using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMasqueradeDAO
    {
        #region User-Facing Methods

        /// <summary>
        /// Create a new anonymous mask identity.
        /// </summary>
        public static BigInteger CreateMask(UInt160 owner, ByteString identityHash, BigInteger maskType, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(identityHash.Length == 32, "invalid hash");
            ExecutionEngine.Assert(maskType >= 1 && maskType <= 2, "invalid mask type");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            BigInteger fee = maskType == 2 ? PREMIUM_MASK_FEE : MASK_FEE;
            ValidatePaymentReceipt(APP_ID, owner, fee, receiptId);

            BigInteger maskId = TotalMasks() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MASK_ID, maskId);

            BigInteger votingPower = GetVotingPowerForType(maskType);

            MaskData mask = new MaskData
            {
                Owner = owner,
                IdentityHash = identityHash,
                MaskType = maskType,
                VotingPower = votingPower,
                Reputation = 0,
                DelegatedTo = 0,
                CreateTime = Runtime.Time,
                VoteCount = 0,
                ProposalsCreated = 0,
                Active = true
            };
            StoreMask(maskId, mask);

            AddUserMask(owner, maskId);
            UpdateMemberStatsOnMaskCreate(owner, maskType);

            OnMaskCreated(maskId, owner, maskType);
            return maskId;
        }

        /// <summary>
        /// Create a new proposal.
        /// </summary>
        public static BigInteger CreateProposal(BigInteger maskId, string title, string description, BigInteger category, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(title.Length > 0 && title.Length <= MAX_TITLE_LENGTH, "invalid title");
            ExecutionEngine.Assert(description.Length <= MAX_DESCRIPTION_LENGTH, "description too long");
            ExecutionEngine.Assert(category >= 1 && category <= 4, "invalid category");

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Active, "mask not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(mask.Owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, mask.Owner, PROPOSAL_FEE, receiptId);

            BigInteger proposalId = TotalProposals() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_ID, proposalId);

            ProposalData proposal = new ProposalData
            {
                Id = proposalId,
                Creator = mask.Owner,
                CreatorMaskId = maskId,
                Title = title,
                Description = description,
                Category = category,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + DEFAULT_VOTING_PERIOD_SECONDS,
                YesVotes = 0,
                NoVotes = 0,
                AbstainVotes = 0,
                TotalVoters = 0,
                Executed = false,
                Passed = false
            };
            StoreProposal(proposalId, proposal);

            mask.ProposalsCreated += 1;
            mask.Reputation += 5;
            StoreMask(maskId, mask);

            UpdateMemberStatsOnProposalCreate(mask.Owner, mask.Reputation);

            BigInteger total = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PROPOSALS, total + 1);

            OnProposalCreated(proposalId, mask.Owner, title, proposal.EndTime);
            OnReputationChanged(maskId, mask.Reputation, "proposal created");
            return proposalId;
        }

        /// <summary>
        /// Submit a vote on a proposal.
        /// </summary>
        public static void SubmitVote(BigInteger proposalId, BigInteger maskId, BigInteger choice, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(choice >= 1 && choice <= 3, "invalid choice");

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Active, "mask not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(mask.Owner), "unauthorized");

            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(proposal.Id > 0, "proposal not found");
            ExecutionEngine.Assert(!proposal.Executed, "proposal executed");
            ExecutionEngine.Assert(Runtime.Time < proposal.EndTime, "voting ended");

            ByteString voteKey = GetVoteKey(proposalId, maskId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voteKey) == null, "already voted");

            ValidatePaymentReceipt(APP_ID, mask.Owner, VOTE_FEE, receiptId);

            BigInteger effectiveVotingPower = GetEffectiveVotingPower(maskId);

            VoteData vote = new VoteData
            {
                MaskId = maskId,
                Choice = choice,
                VotingPower = effectiveVotingPower,
                Timestamp = Runtime.Time
            };
            Storage.Put(Storage.CurrentContext, voteKey, StdLib.Serialize(vote));

            if (choice == 1) proposal.YesVotes += effectiveVotingPower;
            else if (choice == 2) proposal.NoVotes += effectiveVotingPower;
            else proposal.AbstainVotes += effectiveVotingPower;
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
        /// Delegate voting power to another mask.
        /// </summary>
        public static void DelegateVote(BigInteger fromMaskId, BigInteger toMaskId)
        {
            ValidateNotGloballyPaused(APP_ID);

            MaskData fromMask = GetMask(fromMaskId);
            ExecutionEngine.Assert(fromMask.Active, "from mask not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(fromMask.Owner), "unauthorized");

            if (toMaskId > 0)
            {
                MaskData toMask = GetMask(toMaskId);
                ExecutionEngine.Assert(toMask.Active, "to mask not active");
                ExecutionEngine.Assert(fromMaskId != toMaskId, "cannot self-delegate");
            }

            byte[] key = Helper.Concat(PREFIX_DELEGATIONS, (ByteString)fromMaskId.ToByteArray());
            if (toMaskId > 0)
            {
                Storage.Put(Storage.CurrentContext, key, toMaskId);
            }
            else
            {
                Storage.Delete(Storage.CurrentContext, key);
            }

            fromMask.DelegatedTo = toMaskId;
            StoreMask(fromMaskId, fromMask);

            UpdateMemberStatsOnDelegation(fromMask.Owner, toMaskId > 0);

            OnDelegationChanged(fromMaskId, toMaskId);
        }

        /// <summary>
        /// Execute a proposal after voting ends.
        /// </summary>
        public static void ExecuteProposal(BigInteger proposalId)
        {
            ValidateNotGloballyPaused(APP_ID);

            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(proposal.Id > 0, "proposal not found");
            ExecutionEngine.Assert(!proposal.Executed, "already executed");
            ExecutionEngine.Assert(Runtime.Time >= proposal.EndTime, "voting not ended");

            BigInteger totalVotes = proposal.YesVotes + proposal.NoVotes + proposal.AbstainVotes;
            BigInteger totalMasks = TotalMasks();
            BigInteger quorumRequired = totalMasks * QUORUM_BPS / 10000;

            bool quorumMet = proposal.TotalVoters >= quorumRequired || proposal.TotalVoters >= 3;
            bool passed = quorumMet && proposal.YesVotes * 10000 / (proposal.YesVotes + proposal.NoVotes + 1) >= PASS_THRESHOLD_BPS;

            proposal.Executed = true;
            proposal.Passed = passed;
            StoreProposal(proposalId, proposal);

            if (passed)
            {
                BigInteger passedCount = TotalProposalsPassed();
                Storage.Put(Storage.CurrentContext, PREFIX_PROPOSALS_PASSED, passedCount + 1);

                MaskData creatorMask = GetMask(proposal.CreatorMaskId);
                if (creatorMask.Owner != UInt160.Zero)
                {
                    UpdateMemberStatsOnProposalPassed(creatorMask.Owner);
                }
            }
            else
            {
                BigInteger rejectedCount = TotalProposalsRejected();
                Storage.Put(Storage.CurrentContext, PREFIX_PROPOSALS_REJECTED, rejectedCount + 1);
            }

            OnProposalExecuted(proposalId, passed, proposal.YesVotes, proposal.NoVotes);
        }

        /// <summary>
        /// Deactivate a mask.
        /// </summary>
        public static void DeactivateMask(BigInteger maskId)
        {
            ValidateNotGloballyPaused(APP_ID);

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Active, "already inactive");
            ExecutionEngine.Assert(Runtime.CheckWitness(mask.Owner), "unauthorized");

            mask.Active = false;
            StoreMask(maskId, mask);

            UpdateMemberStatsOnMaskDeactivate(mask.Owner);

            OnMaskDeactivated(maskId, mask.Owner);
        }
        #endregion
    }
}
