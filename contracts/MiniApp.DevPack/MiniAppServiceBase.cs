using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniApp DevPack - Service Base Class
    ///
    /// Extends MiniAppBase with service callback and automation functionality:
    /// - Service request/callback pattern (Chainlink-style)
    /// - Automation anchor integration
    /// - Periodic task registration
    ///
    /// STORAGE LAYOUT (0x18-0x1B):
    /// - 0x1A: Request to data mapping
    /// - 0x1B: Reserved
    /// (Automation anchor/task are stored in MiniAppBase: 0x0A/0x0B)
    ///
    /// USE FOR:
    /// - MiniAppOnChainTarot
    /// - MiniAppGuardianPolicy
    /// - MiniAppFlashLoan
    /// - MiniAppRedEnvelope
    /// - Any MiniApp needing external service callbacks
    /// </summary>
    public abstract class MiniAppServiceBase : MiniAppBase
    {
        #region Service Storage Prefixes (0x18-0x1B)

        protected static readonly byte[] PREFIX_SERVICE_REQUEST_DATA = new byte[] { 0x1A };

        #endregion

        #region Events

        public delegate void ServiceRequestedHandler(BigInteger requestId, string serviceType);
        public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType);
        public delegate void AutomationCancelledHandler(BigInteger taskId);

        [DisplayName("ServiceRequested")]
        public static event ServiceRequestedHandler OnServiceRequested;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        #endregion

        #region Automation Management

        protected static BigInteger RegisterAutomationTask(
            string triggerType, string schedule, BigInteger gasLimit)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "anchor not set");

            BigInteger taskId = (BigInteger)Contract.Call(
                anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution",
                triggerType, schedule, gasLimit);

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType);
            return taskId;
        }

        protected static void CancelAutomationTask()
        {
            BigInteger taskId = GetAutomationTaskId();
            ExecutionEngine.Assert(taskId > 0, "no task registered");

            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        protected static void ValidateAutomationAnchor()
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "anchor not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == anchor, "only anchor");
        }

        #endregion

        #region Service Request Methods

        protected static BigInteger RequestService(
            string appId, string serviceType, ByteString payload)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            BigInteger requestId = (BigInteger)Contract.Call(
                gateway,
                "requestService",
                CallFlags.All,
                appId,
                serviceType,
                payload,
                Runtime.ExecutingScriptHash,
                "onServiceCallback"
            );

            OnServiceRequested(requestId, serviceType);
            return requestId;
        }

        protected static BigInteger RequestPriceFeed(string appId, ByteString payload)
        {
            return RequestService(appId, ServiceTypes.PRICE_FEED, payload);
        }

        protected static BigInteger RequestRng(string appId, ByteString payload)
        {
            return RequestService(appId, ServiceTypes.RNG, payload);
        }

        protected static BigInteger RequestEncryption(string appId, ByteString payload)
        {
            return RequestService(appId, ServiceTypes.ENCRYPTION, payload);
        }

        protected static BigInteger RequestDecryption(string appId, ByteString payload)
        {
            return RequestService(appId, ServiceTypes.DECRYPTION, payload);
        }

        #endregion

        #region Request Data Storage

        protected static void StoreRequestData(BigInteger requestId, ByteString data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_SERVICE_REQUEST_DATA, (ByteString)requestId.ToByteArray()),
                data);
        }

        protected static ByteString GetRequestData(BigInteger requestId)
        {
            return Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_SERVICE_REQUEST_DATA, (ByteString)requestId.ToByteArray()));
        }

        protected static void DeleteRequestData(BigInteger requestId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_SERVICE_REQUEST_DATA, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Callback Validation Helpers

        /// <summary>
        /// Standard callback entry validation.
        /// Call this at the start of OnServiceCallback implementation.
        /// </summary>
        protected static ByteString ValidateCallback(BigInteger requestId)
        {
            ValidateGateway();
            ByteString data = GetRequestData(requestId);
            ExecutionEngine.Assert(data != null, "unknown request");
            return data;
        }

        /// <summary>
        /// Cleanup after callback processing.
        /// Call this at the end of OnServiceCallback implementation.
        /// </summary>
        protected static void FinalizeCallback(BigInteger requestId)
        {
            DeleteRequestData(requestId);
        }

        #endregion
    }
}
