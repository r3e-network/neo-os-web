using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Custom delegate for event with named parameters
    public delegate void ServiceCallbackHandler(BigInteger requestId, string appId, string serviceType, bool success);

    [DisplayName("MiniAppServiceConsumer")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Sample MiniApp contract using ServiceLayerGateway callbacks")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-serviceconsumer";
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_LAST = new byte[] { 0x10 };
        #endregion

        public struct CallbackRecord
        {
            public BigInteger RequestId;
            public string AppId;
            public string ServiceType;
            public bool Success;
            public ByteString Result;
            public string Error;
            public BigInteger Timestamp;
        }

        #region App Events
        [DisplayName("ServiceCallback")]
        public static event ServiceCallbackHandler OnServiceCallbackEvent;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }
        #endregion

        #region App Logic

        public static CallbackRecord GetLastCallback()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_LAST);
            if (raw == null)
            {
                return new CallbackRecord
                {
                    RequestId = 0,
                    AppId = "",
                    ServiceType = "",
                    Success = false,
                    Result = (ByteString)"",
                    Error = "",
                    Timestamp = 0
                };
            }
            return (CallbackRecord)StdLib.Deserialize(raw);
        }

        public static BigInteger RequestService(string appId, string serviceType, ByteString payload)
        {
            ValidateAdmin();

            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(serviceType != null && serviceType.Length > 0, "service type required");

            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            return (BigInteger)Contract.Call(
                gateway,
                "requestService",
                CallFlags.All,
                appId,
                serviceType,
                payload ?? (ByteString)"",
                Runtime.ExecutingScriptHash,
                "onServiceCallback"
            );
        }

        public static BigInteger RequestRng(string appId)
        {
            return RequestService(appId, "rng", (ByteString)"");
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)
        {
            ValidateGateway();

            CallbackRecord record = new CallbackRecord
            {
                RequestId = requestId,
                AppId = appId ?? "",
                ServiceType = serviceType ?? "",
                Success = success,
                Result = result ?? (ByteString)"",
                Error = error ?? "",
                Timestamp = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, PREFIX_LAST, StdLib.Serialize(record));
            OnServiceCallbackEvent(requestId, record.AppId, record.ServiceType, record.Success);
        }
        #endregion
    }
}
