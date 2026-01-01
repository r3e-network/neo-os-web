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
    public delegate void ServiceFulfilledHandler(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error);
    public delegate void CallbackAddedHandler(UInt160 contractHash);
    public delegate void CallbackRemovedHandler(UInt160 contractHash);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);
    public delegate void UpdaterChangedHandler(UInt160 oldUpdater, UInt160 newUpdater);

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
        private static readonly byte[] PREFIX_ALLOWED_CALLBACK = new byte[] { 0x05 };
        // Stats storage prefixes
        private static readonly byte[] PREFIX_TOTAL_REQUESTS = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOTAL_FULFILLED = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_REQUESTS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_APP_FULFILLED = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_APP_USERS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_TOTAL_GAS_BURNED = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_APP_GAS_BURNED = new byte[] { 0x16 };

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

        [DisplayName("CallbackAdded")]
        public static event CallbackAddedHandler OnCallbackAdded;

        [DisplayName("CallbackRemoved")]
        public static event CallbackRemovedHandler OnCallbackRemoved;

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged;

        [DisplayName("UpdaterChanged")]
        public static event UpdaterChangedHandler OnUpdaterChanged;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, tx.Sender);
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
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
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
            UInt160 oldUpdater = Updater();
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, updater);
            OnUpdaterChanged(oldUpdater, updater);
        }

        private static StorageMap AllowedCallbackMap() => new StorageMap(Storage.CurrentContext, PREFIX_ALLOWED_CALLBACK);

        public static void AddAllowedCallback(UInt160 contractHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(contractHash != null && contractHash.IsValid, "invalid contract");
            AllowedCallbackMap().Put((byte[])contractHash, 1);
            OnCallbackAdded(contractHash);
        }

        public static void RemoveAllowedCallback(UInt160 contractHash)
        {
            ValidateAdmin();
            AllowedCallbackMap().Delete((byte[])contractHash);
            OnCallbackRemoved(contractHash);
        }

        public static bool IsAllowedCallback(UInt160 contractHash)
        {
            return AllowedCallbackMap().Get((byte[])contractHash) != null;
        }

        // ============ Stats Storage Maps ============
        private static StorageMap AppRequestsMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP_REQUESTS);
        private static StorageMap AppFulfilledMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP_FULFILLED);
        private static StorageMap AppUsersMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP_USERS);
        private static StorageMap AppGasBurnedMap() => new StorageMap(Storage.CurrentContext, PREFIX_APP_GAS_BURNED);

        // ============ Stats Helper Methods ============
        private static void IncrementTotalRequests()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REQUESTS);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REQUESTS, current + 1);
        }

        private static void IncrementTotalFulfilled()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_FULFILLED);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FULFILLED, current + 1);
        }

        private static void IncrementAppRequests(string appId)
        {
            ByteString raw = AppRequestsMap().Get(appId);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            AppRequestsMap().Put(appId, current + 1);
        }

        private static void IncrementAppFulfilled(string appId)
        {
            ByteString raw = AppFulfilledMap().Get(appId);
            BigInteger current = raw == null ? 0 : (BigInteger)raw;
            AppFulfilledMap().Put(appId, current + 1);
        }

        private static void TrackAppUser(string appId, UInt160 user)
        {
            ByteString key = Helper.Concat((ByteString)appId, (ByteString)(byte[])user);
            StorageMap usersMap = AppUsersMap();
            if (usersMap.Get(key) == null)
            {
                usersMap.Put(key, 1);
                // Increment unique user count for this app
                ByteString countKey = Helper.Concat((ByteString)appId, (ByteString)"_count");
                ByteString raw = usersMap.Get(countKey);
                BigInteger current = raw == null ? 0 : (BigInteger)raw;
                usersMap.Put(countKey, current + 1);
            }
        }

        private static void TrackGasBurned(string appId, BigInteger gasAmount)
        {
            // Track total gas burned
            ByteString totalRaw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_GAS_BURNED);
            BigInteger totalCurrent = totalRaw == null ? 0 : (BigInteger)totalRaw;
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_GAS_BURNED, totalCurrent + gasAmount);

            // Track per-app gas burned
            ByteString appRaw = AppGasBurnedMap().Get(appId);
            BigInteger appCurrent = appRaw == null ? 0 : (BigInteger)appRaw;
            AppGasBurnedMap().Put(appId, appCurrent + gasAmount);
        }

        // ============ Stats Query Methods ============
        [Safe]
        public static BigInteger GetTotalRequests()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REQUESTS);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetTotalFulfilled()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_FULFILLED);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetAppRequests(string appId)
        {
            ByteString raw = AppRequestsMap().Get(appId);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetAppFulfilled(string appId)
        {
            ByteString raw = AppFulfilledMap().Get(appId);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetAppUniqueUsers(string appId)
        {
            ByteString countKey = Helper.Concat((ByteString)appId, (ByteString)"_count");
            ByteString raw = AppUsersMap().Get(countKey);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetTotalGasBurned()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_GAS_BURNED);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger GetAppGasBurned(string appId)
        {
            ByteString raw = AppGasBurnedMap().Get(appId);
            return raw == null ? 0 : (BigInteger)raw;
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

            // Record stats
            IncrementTotalRequests();
            IncrementAppRequests(appId);
            TrackAppUser(appId, req.Requester);

            OnServiceRequested(requestId, appId, serviceType, req.Requester, callbackContract, callbackMethod, req.Payload);
            return requestId;
        }

        public static void FulfillRequest(BigInteger requestId, bool success, ByteString result, string error)
        {
            ValidateUpdater();

            ServiceRequest req = GetRequest(requestId);
            ExecutionEngine.Assert(req.Id > 0, "request not found");
            ExecutionEngine.Assert(req.Status == ServiceRequestStatus.Pending, "request already fulfilled");
            ExecutionEngine.Assert(IsAllowedCallback(req.CallbackContract), "callback contract not allowed");

            req.Status = success ? ServiceRequestStatus.Fulfilled : ServiceRequestStatus.Failed;
            req.FulfilledAt = Runtime.Time;
            req.Success = success;
            req.Result = result ?? (ByteString)"";
            req.Error = error ?? "";
            RequestMap().Put(requestId.ToByteArray(), StdLib.Serialize(req));

            // Record fulfilled stats
            IncrementTotalFulfilled();
            IncrementAppFulfilled(req.AppId);

            OnServiceFulfilled(requestId, req.AppId, req.ServiceType, success, req.Result, req.Error);

            Contract.Call(req.CallbackContract, req.CallbackMethod, CallFlags.ReadOnly,
                requestId, req.AppId, req.ServiceType, success, req.Result, req.Error);
        }

        /// <summary>
        /// Record gas fee charged for a service request (called by updater)
        /// </summary>
        public static void RecordGasFee(string appId, BigInteger gasAmount)
        {
            ValidateUpdater();
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(gasAmount > 0, "gas amount must be positive");
            TrackGasBurned(appId, gasAmount);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
