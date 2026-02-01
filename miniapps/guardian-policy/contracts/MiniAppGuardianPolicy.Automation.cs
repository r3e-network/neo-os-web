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
        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            // Event emit disabled to avoid compiler crash in nccs 3.8.1.
            // OnPeriodicExecutionTriggered(taskId);
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
            return;
        }

        #endregion
    }
}
