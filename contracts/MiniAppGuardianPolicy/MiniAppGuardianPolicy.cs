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
    public delegate void PolicyCreatedHandler(BigInteger policyId, UInt160 holder, string assetType, BigInteger coverage);
    public delegate void ClaimRequestedHandler(BigInteger policyId, BigInteger requestId);
    public delegate void ClaimProcessedHandler(BigInteger policyId, UInt160 holder, bool approved, BigInteger payout);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Guardian Policy - Decentralized insurance with automation.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - User creates policy via CreatePolicy (pays premium)
    /// - User requests claim via RequestClaim
    /// - Contract requests price verification from oracle
    /// - Gateway fulfills → Contract evaluates claim → Processes payout
    ///
    /// MECHANICS:
    /// - Cover price drops, smart contract failures, etc.
    /// - Automated claim verification via oracle
    /// - Configurable coverage and premium rates
    /// </summary>
    [DisplayName("MiniAppGuardianPolicy")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Guardian Policy - Decentralized insurance with oracle verification")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-guardianpolicy";
        private const long MIN_COVERAGE = 100000000; // 1 GAS
        private const int PREMIUM_RATE_PERCENT = 5; // 5% of coverage
        private const ulong POLICY_DURATION = 2592000000; // 30 days in ms
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_POLICY_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_POLICIES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_TO_POLICY = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct PolicyData
        {
            public UInt160 Holder;
            public string AssetType;
            public BigInteger Coverage;
            public BigInteger Premium;
            public BigInteger StartPrice;
            public BigInteger ThresholdPercent; // Price drop % to trigger claim
            public BigInteger StartTime;
            public BigInteger EndTime;
            public bool Active;
            public bool Claimed;
        }
        #endregion

        #region App Events
        [DisplayName("PolicyCreated")]
        public static event PolicyCreatedHandler OnPolicyCreated;

        [DisplayName("ClaimRequested")]
        public static event ClaimRequestedHandler OnClaimRequested;

        [DisplayName("ClaimProcessed")]
        public static event ClaimProcessedHandler OnClaimProcessed;

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
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        /// <summary>
        /// Create a new insurance policy.
        /// </summary>
        public static BigInteger CreatePolicy(UInt160 holder, string assetType, BigInteger coverage, BigInteger startPrice, BigInteger thresholdPercent)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(holder), "unauthorized");
            ExecutionEngine.Assert(assetType != null && assetType.Length > 0, "asset type required");
            ExecutionEngine.Assert(coverage >= MIN_COVERAGE, "min coverage 1 GAS");
            ExecutionEngine.Assert(startPrice > 0, "start price required");
            ExecutionEngine.Assert(thresholdPercent > 0 && thresholdPercent <= 50, "threshold 1-50%");

            BigInteger policyId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_POLICY_ID, policyId);

            BigInteger premium = coverage * PREMIUM_RATE_PERCENT / 100;

            PolicyData policy = new PolicyData
            {
                Holder = holder,
                AssetType = assetType,
                Coverage = coverage,
                Premium = premium,
                StartPrice = startPrice,
                ThresholdPercent = thresholdPercent,
                StartTime = (BigInteger)Runtime.Time,
                EndTime = (BigInteger)Runtime.Time + (BigInteger)POLICY_DURATION,
                Active = true,
                Claimed = false
            };
            StorePolicy(policyId, policy);

            OnPolicyCreated(policyId, holder, assetType, coverage);
            return policyId;
        }

        /// <summary>
        /// Request a claim - triggers price verification.
        /// </summary>
        public static void RequestClaim(BigInteger policyId)
        {
            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(policy.Holder != null, "policy not found");
            ExecutionEngine.Assert(policy.Active, "policy inactive");
            ExecutionEngine.Assert(!policy.Claimed, "already claimed");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)policy.EndTime, "policy expired");
            ExecutionEngine.Assert(Runtime.CheckWitness(policy.Holder), "unauthorized");

            // Request current price from oracle
            BigInteger requestId = RequestPriceVerification(policyId, policy.AssetType);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()),
                policyId);

            OnClaimRequested(policyId, requestId);
        }

        [Safe]
        public static PolicyData GetPolicy(BigInteger policyId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_POLICIES, (ByteString)policyId.ToByteArray()));
            if (data == null) return new PolicyData();
            return (PolicyData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestPriceVerification(BigInteger policyId, string assetType)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { policyId, assetType });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "pricefeed", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString policyIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(policyIdData != null, "unknown request");

            BigInteger policyId = (BigInteger)policyIdData;
            PolicyData policy = GetPolicy(policyId);
            ExecutionEngine.Assert(!policy.Claimed, "already claimed");
            ExecutionEngine.Assert(policy.Holder != null, "policy not found");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()));

            bool approved = false;
            BigInteger payout = 0;

            if (success && result != null && result.Length > 0)
            {
                BigInteger currentPrice = (BigInteger)StdLib.Deserialize(result);

                // Calculate price drop percentage
                BigInteger priceDrop = (policy.StartPrice - currentPrice) * 100 / policy.StartPrice;

                // Approve if price dropped more than threshold
                if (priceDrop >= policy.ThresholdPercent)
                {
                    approved = true;
                    // Payout proportional to drop (capped at coverage)
                    payout = policy.Coverage * priceDrop / 100;
                    if (payout > policy.Coverage) payout = policy.Coverage;
                }
            }

            policy.Claimed = true;
            policy.Active = false;
            StorePolicy(policyId, policy);

            OnClaimProcessed(policyId, policy.Holder, approved, payout);
        }

        #endregion

        #region Internal Helpers

        private static void StorePolicy(BigInteger policyId, PolicyData policy)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_POLICIES, (ByteString)policyId.ToByteArray()),
                StdLib.Serialize(policy));
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
        /// LOGIC: Execute policy rules on schedule (check for expired policies, auto-process eligible claims).
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated policy execution
            ProcessAutomatedPolicyExecution();
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
        /// Internal method to process automated policy execution.
        /// Called by OnPeriodicExecution.
        /// LOGIC: Check active policies for expiration or auto-claim eligibility.
        /// </summary>
        private static void ProcessAutomatedPolicyExecution()
        {
            // Get total policies
            BigInteger policyCount = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POLICY_ID);
            if (policyCount == 0) return;

            // Process recent active policies (last 10 for gas efficiency)
            BigInteger startId = policyCount > 10 ? policyCount - 10 : 1;
            ulong currentTime = Runtime.Time;

            for (BigInteger i = startId; i <= policyCount; i++)
            {
                PolicyData policy = GetPolicy(i);
                if (policy.Holder == null || !policy.Active || policy.Claimed) continue;

                // Check if policy expired
                if (currentTime > (ulong)policy.EndTime)
                {
                    // Mark policy as inactive (expired without claim)
                    policy.Active = false;
                    StorePolicy(i, policy);
                    continue;
                }

                // For active policies, check price condition and auto-trigger claim if eligible
                // Request current price to evaluate claim eligibility
                BigInteger requestId = RequestPriceVerification(i, policy.AssetType);
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_REQUEST_TO_POLICY, (ByteString)requestId.ToByteArray()),
                    i);

                OnClaimRequested(i, requestId);
            }
        }

        #endregion
    }
}
