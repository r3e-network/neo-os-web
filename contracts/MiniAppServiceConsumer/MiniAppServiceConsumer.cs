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
    public class MiniAppServiceConsumer : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_LAST = new byte[] { 0x03 };

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

        [DisplayName("ServiceCallback")]
        public static event ServiceCallbackHandler OnServiceCallbackEvent;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        public static UInt160 Gateway()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        }

        public static void SetGateway(UInt160 gateway)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "invalid gateway");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

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
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "unauthorized caller");

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

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
