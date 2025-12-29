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
    public delegate void ProposalCreatedHandler(string proposalId, UInt160 creator, BigInteger endTime);
    public delegate void VoteSubmittedHandler(string proposalId, UInt160 voter, BigInteger voteId);
    public delegate void TallyRequestedHandler(string proposalId, BigInteger requestId);
    public delegate void TallyCompletedHandler(string proposalId, BigInteger yesVotes, BigInteger noVotes, bool passed);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Secret Vote - Privacy-preserving voting with TEE computation.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Admin creates proposal via CreateProposal
    /// - Voters submit encrypted votes via SubmitVote
    /// - After deadline, RequestTally → TEE decrypts and counts votes
    /// - Gateway fulfills → Contract stores and emits result
    ///
    /// MECHANICS:
    /// - Votes encrypted client-side with TEE public key
    /// - TEE decrypts in secure enclave, returns only totals
    /// - Individual vote choices never revealed on-chain
    /// </summary>
    [DisplayName("MiniAppSecretVote")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Secret Vote - Privacy-preserving voting with TEE computation")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-secretvote";
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_PROPOSAL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_VOTES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_VOTER = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_TO_PROPOSAL = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_VOTE_ID = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_PROPOSAL_INDEX = new byte[] { 0x15 };
        #endregion

        #region Data Structures
        public struct ProposalData
        {
            public UInt160 Creator;
            public string Description;
            public BigInteger EndTime;
            public BigInteger VoteCount;
            public bool Tallied;
            public BigInteger YesVotes;
            public BigInteger NoVotes;
        }
        #endregion

        #region App Events
        [DisplayName("ProposalCreated")]
        public static event ProposalCreatedHandler OnProposalCreated;

        [DisplayName("VoteSubmitted")]
        public static event VoteSubmittedHandler OnVoteSubmitted;

        [DisplayName("TallyRequested")]
        public static event TallyRequestedHandler OnTallyRequested;

        [DisplayName("TallyCompleted")]
        public static event TallyCompletedHandler OnTallyCompleted;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_VOTE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Create a new proposal for voting.
        /// </summary>
        public static void CreateProposal(string proposalId, UInt160 creator, string description, BigInteger durationMs)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(proposalId != null && proposalId.Length > 0, "proposal id required");
            ExecutionEngine.Assert(durationMs > 0, "duration required");

            ByteString existing = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSAL, (ByteString)proposalId));
            ExecutionEngine.Assert(existing == null, "proposal exists");

            ProposalData proposal = new ProposalData
            {
                Creator = creator,
                Description = description,
                EndTime = (BigInteger)Runtime.Time + durationMs,
                VoteCount = 0,
                Tallied = false,
                YesVotes = 0,
                NoVotes = 0
            };
            StoreProposal(proposalId, proposal);

            // Track proposal for automation
            BigInteger proposalCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_INDEX);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_PROPOSAL_INDEX, (ByteString)proposalCount.ToByteArray()),
                proposalId);
            Storage.Put(Storage.CurrentContext, PREFIX_PROPOSAL_INDEX, proposalCount + 1);

            OnProposalCreated(proposalId, creator, proposal.EndTime);
        }

        /// <summary>
        /// Submit an encrypted vote.
        /// </summary>
        public static BigInteger SubmitVote(string proposalId, UInt160 voter, ByteString encryptedVote)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");

            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(proposal.Creator != null, "proposal not found");
            ExecutionEngine.Assert(!proposal.Tallied, "already tallied");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)proposal.EndTime, "voting ended");

            // Check if already voted
            ByteString voterKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER, (ByteString)proposalId),
                (ByteString)(byte[])voter);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voterKey) == null, "already voted");

            // Store encrypted vote
            BigInteger voteId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_VOTE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_VOTE_ID, voteId);

            ByteString voteKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTES, (ByteString)proposalId),
                (ByteString)voteId.ToByteArray());
            Storage.Put(Storage.CurrentContext, voteKey, encryptedVote);

            // Mark voter as voted
            Storage.Put(Storage.CurrentContext, voterKey, voteId);

            // Update vote count
            proposal.VoteCount = proposal.VoteCount + 1;
            StoreProposal(proposalId, proposal);

            OnVoteSubmitted(proposalId, voter, voteId);
            return voteId;
        }

        /// <summary>
        /// Request vote tally after voting period ends.
        /// </summary>
        public static void RequestTally(string proposalId)
        {
            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(proposal.Creator != null, "proposal not found");
            ExecutionEngine.Assert(!proposal.Tallied, "already tallied");
            ExecutionEngine.Assert(Runtime.Time > (ulong)proposal.EndTime, "voting not ended");
            ExecutionEngine.Assert(
                Runtime.CheckWitness(proposal.Creator) || Runtime.CheckWitness(Admin()),
                "unauthorized"
            );

            // Request TEE computation to decrypt and tally votes
            BigInteger requestId = RequestTeeCompute(proposalId, proposal.VoteCount);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_PROPOSAL, (ByteString)requestId.ToByteArray()),
                proposalId);

            OnTallyRequested(proposalId, requestId);
        }

        [Safe]
        public static ProposalData GetProposal(string proposalId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSAL, (ByteString)proposalId));
            if (data == null) return new ProposalData();
            return (ProposalData)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasVoted(string proposalId, UInt160 voter)
        {
            ByteString voterKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER, (ByteString)proposalId),
                (ByteString)(byte[])voter);
            return Storage.Get(Storage.CurrentContext, voterKey) != null;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestTeeCompute(string proposalId, BigInteger voteCount)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { proposalId, voteCount });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "tee-compute", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString proposalIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_PROPOSAL, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(proposalIdData != null, "unknown request");

            string proposalId = (string)proposalIdData;
            ProposalData proposal = GetProposal(proposalId);
            ExecutionEngine.Assert(!proposal.Tallied, "already tallied");
            ExecutionEngine.Assert(proposal.Creator != null, "proposal not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_PROPOSAL, (ByteString)requestId.ToByteArray()));

            proposal.Tallied = true;

            if (success && result != null && result.Length > 0)
            {
                // Result format: [yesVotes, noVotes]
                object[] tallyResult = (object[])StdLib.Deserialize(result);
                proposal.YesVotes = (BigInteger)tallyResult[0];
                proposal.NoVotes = (BigInteger)tallyResult[1];
            }

            StoreProposal(proposalId, proposal);

            bool passed = proposal.YesVotes > proposal.NoVotes;
            OnTallyCompleted(proposalId, proposal.YesVotes, proposal.NoVotes, passed);
        }

        #endregion

        #region Internal Helpers

        private static void StoreProposal(string proposalId, ProposalData proposal)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSAL, (ByteString)proposalId),
                StdLib.Serialize(proposal));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Auto-tallies votes for proposals after deadline.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated tally for ended proposals
            ProcessAutomatedTally();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated tally for ended proposals.
        /// Called by OnPeriodicExecution.
        /// </summary>
        private static void ProcessAutomatedTally()
        {
            // Iterate through recent proposals to check if they need tallying
            BigInteger proposalCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PROPOSAL_INDEX);
            BigInteger startIdx = proposalCount > 10 ? proposalCount - 10 : 0;

            for (BigInteger i = startIdx; i < proposalCount; i++)
            {
                ByteString proposalIdData = Storage.Get(Storage.CurrentContext,
                    Helper.Concat(PREFIX_PROPOSAL_INDEX, (ByteString)i.ToByteArray()));

                if (proposalIdData == null)
                {
                    continue;
                }

                string proposalId = (string)proposalIdData;
                ProposalData proposal = GetProposal(proposalId);

                // Skip if proposal doesn't exist or already tallied
                if (proposal.Creator == null || proposal.Tallied)
                {
                    continue;
                }

                // Check if voting period ended
                if (Runtime.Time > (ulong)proposal.EndTime)
                {
                    // Request TEE computation to decrypt and tally votes
                    BigInteger requestId = RequestTeeCompute(proposalId, proposal.VoteCount);
                    Storage.Put(Storage.CurrentContext,
                        Helper.Concat((ByteString)PREFIX_REQUEST_TO_PROPOSAL, (ByteString)requestId.ToByteArray()),
                        proposalId);

                    OnTallyRequested(proposalId, requestId);
                }
            }
        }

        #endregion
    }
}
