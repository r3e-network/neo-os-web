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
    public enum ServiceRequestStatus : byte
    {
        Pending = 0,
        Fulfilled = 1,
        Failed = 2
    }

    // Custom delegates for events with named parameters
    public delegate void ServiceRequestedHandler(BigInteger requestId, string appId, string serviceType, UInt160 requester, UInt160 callbackContract, string callbackMethod, ByteString payload);
    public delegate void ServiceFulfilledHandler(BigInteger requestId, bool success, ByteString result, string error);

    [DisplayName("ServiceLayerGateway")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "On-chain service request router + callback dispatcher")]
    [ContractPermission("*", "*")]
    public class ServiceLayerGateway : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_UPDATER = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_REQUEST = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_COUNTER = new byte[] { 0x04 };

        public struct ServiceRequest
        {
            public BigInteger Id;
            public string AppId;
            public string ServiceType;
            public ByteString Payload;
            public UInt160 CallbackContract;
            public string CallbackMethod;
            public UInt160 Requester;
            public ServiceRequestStatus Status;
            public BigInteger CreatedAt;
            public BigInteger FulfilledAt;
            public bool Success;
            public ByteString Result;
            public string Error;
        }

        [DisplayName("ServiceRequested")]
        public static event ServiceRequestedHandler OnServiceRequested;

        [DisplayName("ServiceFulfilled")]
        public static event ServiceFulfilledHandler OnServiceFulfilled;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_COUNTER, 0);
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

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static UInt160 Updater()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_UPDATER);
        }

        private static void ValidateUpdater()
        {
            UInt160 updater = Updater();
            ExecutionEngine.Assert(updater != null, "updater not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(updater), "unauthorized");
        }

        public static void SetUpdater(UInt160 updater)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(updater != null && updater.IsValid, "invalid updater");
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, updater);
        }

        private static StorageMap RequestMap() => new StorageMap(Storage.CurrentContext, PREFIX_REQUEST);

        private static BigInteger NextRequestId()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_COUNTER);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            BigInteger next = current + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_COUNTER, next);
            return next;
        }

        public static ServiceRequest GetRequest(BigInteger requestId)
        {
            ByteString raw = RequestMap().Get(requestId.ToByteArray());
            if (raw == null)
            {
                return new ServiceRequest
                {
                    Id = 0,
                    AppId = "",
                    ServiceType = "",
                    Payload = (ByteString)"",
                    CallbackContract = null,
                    CallbackMethod = "",
                    Requester = null,
                    Status = ServiceRequestStatus.Pending,
                    CreatedAt = 0,
                    FulfilledAt = 0,
                    Success = false,
                    Result = (ByteString)"",
                    Error = ""
                };
            }
            return (ServiceRequest)StdLib.Deserialize(raw);
        }

        public static BigInteger RequestService(string appId, string serviceType, ByteString payload, UInt160 callbackContract, string callbackMethod)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(serviceType != null && serviceType.Length > 0, "service type required");
            ExecutionEngine.Assert(callbackContract != null && callbackContract.IsValid, "callback contract required");
            ExecutionEngine.Assert(callbackMethod != null && callbackMethod.Length > 0, "callback method required");

            BigInteger requestId = NextRequestId();
            ServiceRequest req = new ServiceRequest
            {
                Id = requestId,
                AppId = appId,
                ServiceType = serviceType,
                Payload = payload ?? (ByteString)"",
                CallbackContract = callbackContract,
                CallbackMethod = callbackMethod,
                Requester = Runtime.Transaction.Sender,
                Status = ServiceRequestStatus.Pending,
                CreatedAt = Runtime.Time,
                FulfilledAt = 0,
                Success = false,
                Result = (ByteString)"",
                Error = ""
            };

            RequestMap().Put(requestId.ToByteArray(), StdLib.Serialize(req));
            OnServiceRequested(requestId, appId, serviceType, req.Requester, callbackContract, callbackMethod, req.Payload);
            return requestId;
        }

        public static void FulfillRequest(BigInteger requestId, bool success, ByteString result, string error)
        {
            ValidateUpdater();

            ServiceRequest req = GetRequest(requestId);
            ExecutionEngine.Assert(req.Id > 0, "request not found");
            ExecutionEngine.Assert(req.Status == ServiceRequestStatus.Pending, "request already fulfilled");

            req.Status = success ? ServiceRequestStatus.Fulfilled : ServiceRequestStatus.Failed;
            req.FulfilledAt = Runtime.Time;
            req.Success = success;
            req.Result = result ?? (ByteString)"";
            req.Error = error ?? "";
            RequestMap().Put(requestId.ToByteArray(), StdLib.Serialize(req));

            OnServiceFulfilled(requestId, success, req.Result, req.Error);

            Contract.Call(req.CallbackContract, req.CallbackMethod, CallFlags.All,
                requestId, req.AppId, req.ServiceType, success, req.Result, req.Error);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
