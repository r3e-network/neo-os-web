using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Periodic Automation

        public static new void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);
            ProcessAutomatedRefund();
        }

        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            return RegisterAutomationTask(triggerType, schedule, 1000000);
        }

        public static void CancelAutomation()
        {
            ValidateAdmin();
            CancelAutomationTask();
        }

        private static void ProcessAutomatedRefund()
        {
            BigInteger currentEnvelopeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID);
            // Check last 20 envelopes for expiry
            BigInteger startId = currentEnvelopeId > 20 ? currentEnvelopeId - 20 : 1;

            for (BigInteger envelopeId = startId; envelopeId <= currentEnvelopeId; envelopeId++)
            {
                EnvelopeData envelope = GetEnvelope(envelopeId);

                // Skip invalid or already completed
                if (envelope.Creator == null) continue;
                if (!envelope.Ready && Runtime.Time > (ulong)envelope.ExpiryTime + 86400)
                {
                    // If not ready (setup failed/timeout) and long expired, cleanup seed
                    DeleteOperationSeed(envelopeId);
                    continue;
                }
                
                if (Runtime.Time > (ulong)envelope.ExpiryTime && envelope.RemainingAmount > 0)
                {
                    BigInteger refundAmount = envelope.RemainingAmount;
                    envelope.RemainingAmount = 0;
                    StoreEnvelope(envelopeId, envelope);

                    // Execute refund transfer
                    GAS.Transfer(Runtime.ExecutingScriptHash, envelope.Creator, refundAmount);

                    // Clean up seed if it exists (for lazy settlement)
                    DeleteOperationSeed(envelopeId);

                    OnEnvelopeRefunded(envelopeId, envelope.Creator, refundAmount);
                }
                // Cleanup seed for fully claimed envelopes past expiry just in case
                else if (Runtime.Time > (ulong)envelope.ExpiryTime && envelope.RemainingAmount == 0)
                {
                    DeleteOperationSeed(envelopeId);
                }
            }
        }

        #endregion
        

    }
}
