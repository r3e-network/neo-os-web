using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGuardianPolicy
    {
        #region Periodic Automation

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);
            ProcessAutomatedPolicyExecution();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            return RegisterAutomationTask(triggerType, schedule, 1000000);
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            CancelAutomationTask();
        }

        /// <summary>
        /// Internal method to process automated policy execution.
        /// </summary>
        private static void ProcessAutomatedPolicyExecution()
        {
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
                    policy.Active = false;
                    StorePolicy(i, policy);
                    continue;
                }

                // Request price verification for active policies
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
