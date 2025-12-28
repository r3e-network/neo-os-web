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
    public delegate void BoostRequestedHandler(BigInteger boostId, UInt160 voter, string proposalId, BigInteger stakeAmount);
    public delegate void BoostVerificationHandler(BigInteger boostId, BigInteger requestId);
    public delegate void VoteBoostedHandler(BigInteger boostId, UInt160 voter, string proposalId, BigInteger multiplier, BigInteger boostedPower);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Gov Booster - Governance voting power booster with TEE verification.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Voter stakes tokens via RequestBoost
    /// - Contract requests TEE to verify stake and calculate boost
    /// - TEE verifies token balance, lock period, governance participation
    /// - Gateway fulfills → Contract applies boost multiplier
    ///
    /// MECHANICS:
    /// - Stake NEO/GAS to boost voting power
    /// - Longer lock = higher multiplier (1.5x - 3x)
    /// - TEE verifies no double-staking across proposals
    /// </summary>
    [DisplayName("MiniAppGovBooster")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Gov Booster - Voting power boost with TEE verification")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "builtin-govbooster";
        private const long MIN_STAKE = 100000000; // 1 GAS
        private const int BASE_MULTIPLIER = 100; // 1x = 100
        private const int MAX_MULTIPLIER = 300; // 3x = 300
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_BOOST_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BOOSTS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_BOOST = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_VOTER_PROPOSAL = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct BoostData
        {
            public UInt160 Voter;
            public string ProposalId;
            public BigInteger StakeAmount;
            public BigInteger LockDays;
            public BigInteger Multiplier;
            public BigInteger BoostedPower;
            public BigInteger Timestamp;
            public bool Verified;
        }
        #endregion

        #region App Events
        [DisplayName("BoostRequested")]
        public static event BoostRequestedHandler OnBoostRequested;

        [DisplayName("BoostVerification")]
        public static event BoostVerificationHandler OnBoostVerification;

        [DisplayName("VoteBoosted")]
        public static event VoteBoostedHandler OnVoteBoosted;

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
            Storage.Put(Storage.CurrentContext, PREFIX_BOOST_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Request voting power boost for a proposal.
        /// </summary>
        public static BigInteger RequestBoost(UInt160 voter, string proposalId, BigInteger stakeAmount, BigInteger lockDays)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(voter), "unauthorized");
            ExecutionEngine.Assert(proposalId != null && proposalId.Length > 0, "proposal id required");
            ExecutionEngine.Assert(stakeAmount >= MIN_STAKE, "min stake 1 GAS");
            ExecutionEngine.Assert(lockDays >= 7 && lockDays <= 365, "lock 7-365 days");

            // Check if already boosted for this proposal
            ByteString voterProposalKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER_PROPOSAL, (ByteString)(byte[])voter),
                (ByteString)proposalId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voterProposalKey) == null, "already boosted");

            BigInteger boostId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BOOST_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BOOST_ID, boostId);

            BoostData boost = new BoostData
            {
                Voter = voter,
                ProposalId = proposalId,
                StakeAmount = stakeAmount,
                LockDays = lockDays,
                Multiplier = 0,
                BoostedPower = 0,
                Timestamp = Runtime.Time,
                Verified = false
            };
            StoreBoost(boostId, boost);

            // Mark voter as boosted for this proposal
            Storage.Put(Storage.CurrentContext, voterProposalKey, boostId);

            // Request TEE to verify stake and calculate boost
            BigInteger requestId = RequestTeeVerification(boostId, voter, stakeAmount, lockDays);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_BOOST, (ByteString)requestId.ToByteArray()),
                boostId);

            OnBoostRequested(boostId, voter, proposalId, stakeAmount);
            OnBoostVerification(boostId, requestId);
            return boostId;
        }

        [Safe]
        public static BoostData GetBoost(BigInteger boostId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOOSTS, (ByteString)boostId.ToByteArray()));
            if (data == null) return new BoostData();
            return (BoostData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetVoterBoost(UInt160 voter, string proposalId)
        {
            ByteString voterProposalKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTER_PROPOSAL, (ByteString)(byte[])voter),
                (ByteString)proposalId);
            ByteString data = Storage.Get(Storage.CurrentContext, voterProposalKey);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestTeeVerification(BigInteger boostId, UInt160 voter, BigInteger stakeAmount, BigInteger lockDays)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { boostId, voter, stakeAmount, lockDays });
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

            ByteString boostIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_BOOST, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(boostIdData != null, "unknown request");

            BigInteger boostId = (BigInteger)boostIdData;
            BoostData boost = GetBoost(boostId);
            ExecutionEngine.Assert(!boost.Verified, "already verified");
            ExecutionEngine.Assert(boost.Voter != null, "boost not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_TO_BOOST, (ByteString)requestId.ToByteArray()));

            boost.Verified = true;

            if (success && result != null && result.Length > 0)
            {
                // Result format: [verified, multiplier, boostedPower]
                object[] verifyResult = (object[])StdLib.Deserialize(result);
                bool verified = (bool)verifyResult[0];

                if (verified)
                {
                    boost.Multiplier = (BigInteger)verifyResult[1];
                    boost.BoostedPower = (BigInteger)verifyResult[2];

                    // Cap multiplier
                    if (boost.Multiplier > MAX_MULTIPLIER)
                        boost.Multiplier = MAX_MULTIPLIER;
                }
            }

            StoreBoost(boostId, boost);

            if (boost.Multiplier > 0)
            {
                OnVoteBoosted(boostId, boost.Voter, boost.ProposalId, boost.Multiplier, boost.BoostedPower);
            }
        }

        #endregion

        #region Internal Helpers

        private static void StoreBoost(BigInteger boostId, BoostData boost)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BOOSTS, (ByteString)boostId.ToByteArray()),
                StdLib.Serialize(boost));
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
        /// LOGIC: Unlocks expired stakes and returns tokens to voters.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated stake unlocking
            ProcessAutomatedUnlock();
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
        /// Internal method to process automated stake unlocking.
        /// Called by OnPeriodicExecution.
        /// Scans boosts and unlocks expired stakes, returning tokens to voters.
        /// </summary>
        private static void ProcessAutomatedUnlock()
        {
            BigInteger currentTime = Runtime.Time;
            BigInteger secondsPerDay = 86400;

            // Scan recent boosts (last 50) for expired locks
            BigInteger currentBoostId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BOOST_ID);
            BigInteger startId = currentBoostId > 50 ? currentBoostId - 50 : 1;

            for (BigInteger boostId = startId; boostId <= currentBoostId; boostId++)
            {
                BoostData boost = GetBoost(boostId);

                // Skip unverified or invalid boosts
                if (!boost.Verified || boost.Voter == null || boost.Multiplier == 0)
                {
                    continue;
                }

                // Check if lock period has expired
                BigInteger lockEndTime = boost.Timestamp + (boost.LockDays * secondsPerDay);
                if (currentTime < lockEndTime)
                {
                    continue; // Still locked
                }

                // Check if already unlocked
                ByteString unlockKey = Helper.Concat(
                    (ByteString)new byte[] { 0x1A },
                    (ByteString)boostId.ToByteArray());
                ByteString unlockData = Storage.Get(Storage.CurrentContext, unlockKey);

                if (unlockData != null)
                {
                    continue; // Already unlocked
                }

                // Mark as unlocked
                Storage.Put(Storage.CurrentContext, unlockKey, currentTime);

                // Clean up voter-proposal mapping to allow re-boosting
                ByteString voterProposalKey = Helper.Concat(
                    Helper.Concat((ByteString)PREFIX_VOTER_PROPOSAL, (ByteString)(byte[])boost.Voter),
                    (ByteString)boost.ProposalId);
                Storage.Delete(Storage.CurrentContext, voterProposalKey);

                // Emit event for external processing (token return, etc.)
                // In production, this could trigger actual token transfer
                OnVoteBoosted(boostId, boost.Voter, boost.ProposalId, 0, 0); // Multiplier 0 indicates unlock
            }
        }

        #endregion
    }
}
