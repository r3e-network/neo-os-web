using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Modules
{
    /// <summary>
    /// Universal oracle callback handler module that any miniapp instance can use.
    ///
    /// MULTI-TENANCY:
    /// All oracle requests and callback state are namespaced by instance ID.
    /// A single deployed contract routes oracle results to the correct instance handler.
    ///
    /// SUPPORTED ORACLE RESULT TYPES:
    /// - RNG:        random number generation results
    /// - PriceFeed:  asset price feed results
    /// - HTTPOracle: arbitrary HTTP oracle results
    ///
    /// FLOW:
    /// 1. Instance controller calls RequestOracle() with request type and payload.
    /// 2. This module forwards the request to the configured Morpheus Oracle.
    /// 3. The Oracle processes the request off-chain (TEE-backed).
    /// 4. Oracle calls back OnOracleResult() on this contract.
    /// 5. This module stores the result and optionally forwards it to the instance's
    ///    registered callback contract.
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, set oracle address
    /// - Instance controller: submit oracle requests, register callback contracts
    /// - Oracle contract: deliver callback results (CallingScriptHash check)
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       instance registry address
    /// - 0x03       oracle contract address
    /// - 0x10       instance config (per instance)
    /// - 0x20       request info (per request ID)
    /// - 0x21       request counter (global)
    /// - 0x30       latest result (per instance + request type)
    /// </summary>
    [DisplayName("OracleCallbackModule")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal instance-scoped oracle callback handler for RNG, PriceFeed, and HTTP results")]
    [ContractPermission("*", "*")]
    public class OracleCallbackModule : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_ORACLE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_INSTANCE_CONFIG = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_REQUEST = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_REQUEST_COUNTER = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_LATEST_RESULT = new byte[] { 0x30 };

        #endregion

        #region Constants

        /// <summary>Oracle request type: random number generation.</summary>
        public const string TYPE_RNG = "rng";

        /// <summary>Oracle request type: price feed.</summary>
        public const string TYPE_PRICE_FEED = "pricefeed";

        /// <summary>Oracle request type: HTTP oracle.</summary>
        public const string TYPE_HTTP = "http";

        /// <summary>Request status: pending callback.</summary>
        public const byte STATUS_PENDING = 0;

        /// <summary>Request status: callback received, success.</summary>
        public const byte STATUS_FULFILLED = 1;

        /// <summary>Request status: callback received, failed.</summary>
        public const byte STATUS_FAILED = 2;

        #endregion

        #region Data Structures

        public struct InstanceConfig
        {
            public string InstanceId;
            public UInt160 Owner;
            public UInt160 Operator;
            /// <summary>
            /// Optional callback contract that receives forwarded oracle results.
            /// If UInt160.Zero, results are stored but not forwarded.
            /// </summary>
            public UInt160 CallbackContract;
            /// <summary>
            /// Method name on the callback contract to invoke with results.
            /// Ignored if CallbackContract is zero.
            /// </summary>
            public string CallbackMethod;
            public bool Active;
            public BigInteger UpdatedAt;
        }

        public struct OracleRequest
        {
            public BigInteger RequestId;
            public string InstanceId;
            public string RequestType;
            public ByteString Payload;
            public UInt160 Requester;
            public byte Status;
            public ByteString Result;
            public string Error;
            public BigInteger RequestedAt;
            public BigInteger FulfilledAt;
        }

        public struct OracleResult
        {
            public BigInteger RequestId;
            public string RequestType;
            public bool Success;
            public ByteString Data;
            public string Error;
            public BigInteger Timestamp;
        }

        #endregion

        #region Events

        [DisplayName("OracleRequested")]
        public static event Action<string, BigInteger, string, UInt160> OnOracleRequested = delegate { };

        [DisplayName("OracleCallbackReceived")]
        public static event Action<string, BigInteger, string, bool> OnOracleCallbackReceived = delegate { };

        [DisplayName("OracleResultForwarded")]
        public static event Action<string, BigInteger, UInt160, string> OnOracleResultForwarded = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, UInt160, UInt160, string> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("OracleAddressChanged")]
        public static event Action<UInt160, UInt160> OnOracleAddressChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_REQUEST_COUNTER, 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Internal Helpers

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static void ValidateAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin);
        }

        private static bool IsRegistryCaller()
        {
            UInt160 registry = InstanceRegistry();
            return registry != UInt160.Zero && registry.IsValid && Runtime.CallingScriptHash == registry;
        }

        private static bool IsOperatorCaller(InstanceConfig config)
        {
            UInt160 op = config.Operator;
            return op != UInt160.Zero && op.IsValid && Runtime.CallingScriptHash == op;
        }

        private static bool IsInstanceController(InstanceConfig config)
        {
            return IsAdminWitness() ||
                   IsRegistryCaller() ||
                   (config.Owner != UInt160.Zero && Runtime.CheckWitness(config.Owner)) ||
                   IsOperatorCaller(config);
        }

        private static void ValidateOracle()
        {
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == oracle, "only oracle");
        }

        private static void RequireActiveInstance(InstanceConfig config)
        {
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(config.Active, "instance inactive");
        }

        private static InstanceConfig EmptyConfig()
        {
            return new InstanceConfig
            {
                InstanceId = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                CallbackContract = UInt160.Zero,
                CallbackMethod = "",
                Active = false,
                UpdatedAt = 0
            };
        }

        private static OracleRequest EmptyRequest()
        {
            return new OracleRequest
            {
                RequestId = 0,
                InstanceId = "",
                RequestType = "",
                Payload = (ByteString)"",
                Requester = UInt160.Zero,
                Status = STATUS_PENDING,
                Result = (ByteString)"",
                Error = "",
                RequestedAt = 0,
                FulfilledAt = 0
            };
        }

        private static byte[] ConfigKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return Helper.Concat(PREFIX_INSTANCE_CONFIG, (ByteString)(instanceId ?? ""));
        }

        private static byte[] RequestKey(BigInteger requestId)
        {
            return Helper.Concat(PREFIX_REQUEST, (ByteString)requestId.ToByteArray());
        }

        private static byte[] LatestResultKey(string instanceId, string requestType)
        {
            return Helper.Concat(PREFIX_LATEST_RESULT,
                (ByteString)((instanceId ?? "") + "|" + (requestType ?? "")));
        }

        private static BigInteger GetNextRequestId()
        {
            ByteString? counterBytes = Storage.Get(Storage.CurrentContext, PREFIX_REQUEST_COUNTER);
            BigInteger counter = counterBytes == null ? 1 : (BigInteger)counterBytes + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_REQUEST_COUNTER, counter);
            return counter;
        }

        private static void ValidateRequestType(string requestType)
        {
            string normalized = requestType ?? "";
            ExecutionEngine.Assert(
                normalized == TYPE_RNG || normalized == TYPE_PRICE_FEED || normalized == TYPE_HTTP,
                "invalid request type: must be rng, pricefeed, or http");
        }

        #endregion

        #region Safe Queries

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 InstanceRegistry()
        {
            return ReadAddress(PREFIX_INSTANCE_REGISTRY);
        }

        [Safe]
        public static UInt160 Oracle()
        {
            return ReadAddress(PREFIX_ORACLE);
        }

        [Safe]
        public static InstanceConfig GetInstanceConfig(string instanceId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, ConfigKey(instanceId));
            return raw == null ? EmptyConfig() : (InstanceConfig)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the details of an oracle request by its ID.
        /// </summary>
        [Safe]
        public static OracleRequest GetRequest(BigInteger requestId)
        {
            ByteString? raw = Storage.Get(Storage.CurrentContext, RequestKey(requestId));
            return raw == null ? EmptyRequest() : (OracleRequest)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the latest oracle result for a specific request type within an instance.
        /// </summary>
        [Safe]
        public static OracleResult GetLatestResult(string instanceId, string requestType)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateRequestType(requestType);

            ByteString? raw = Storage.Get(Storage.CurrentContext, LatestResultKey(instanceId, requestType));
            if (raw == null)
            {
                return new OracleResult
                {
                    RequestId = 0,
                    RequestType = requestType,
                    Success = false,
                    Data = (ByteString)"",
                    Error = "",
                    Timestamp = 0
                };
            }
            return (OracleResult)StdLib.Deserialize(raw);
        }

        /// <summary>
        /// Get the total number of oracle requests submitted.
        /// </summary>
        [Safe]
        public static BigInteger GetTotalRequests()
        {
            ByteString? counterBytes = Storage.Get(Storage.CurrentContext, PREFIX_REQUEST_COUNTER);
            return counterBytes == null ? 0 : (BigInteger)counterBytes;
        }

        #endregion

        #region Instance Management

        /// <summary>
        /// Initialize or reconfigure an oracle callback instance.
        /// </summary>
        public static void InitializeInstance(
            string instanceId,
            UInt160 owner,
            UInt160 operatorAddress,
            UInt160 callbackContract,
            string callbackMethod)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateAddress(owner, "owner");

            InstanceConfig existing = GetInstanceConfig(instanceId);
            bool canInitialize = IsAdminWitness() || IsRegistryCaller();
            if (!canInitialize && existing.InstanceId.Length > 0)
            {
                canInitialize = IsInstanceController(existing);
            }
            ExecutionEngine.Assert(canInitialize, "unauthorized");

            string normalizedMethod = callbackMethod ?? "";
            ExecutionEngine.Assert(normalizedMethod.Length <= 64, "callback method too long");

            InstanceConfig config = new InstanceConfig
            {
                InstanceId = instanceId,
                Owner = owner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                CallbackContract = NormalizeOptionalAddress(callbackContract),
                CallbackMethod = normalizedMethod,
                Active = existing.InstanceId.Length == 0 || existing.Active,
                UpdatedAt = Runtime.Time
            };

            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceInitialized(instanceId, owner, config.CallbackContract, normalizedMethod);
        }

        /// <summary>
        /// Update the callback contract and method for an existing instance.
        /// </summary>
        public static void SetCallback(
            string instanceId,
            UInt160 callbackContract,
            string callbackMethod)
        {
            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            string normalizedMethod = callbackMethod ?? "";
            ExecutionEngine.Assert(normalizedMethod.Length <= 64, "callback method too long");

            config.CallbackContract = NormalizeOptionalAddress(callbackContract);
            config.CallbackMethod = normalizedMethod;
            config.UpdatedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
        }

        /// <summary>
        /// Activate or deactivate an instance.
        /// </summary>
        public static void SetInstanceActive(string instanceId, bool active)
        {
            InstanceConfig config = GetInstanceConfig(instanceId);
            ExecutionEngine.Assert(config.InstanceId.Length > 0, "instance not found");
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized");

            config.Active = active;
            config.UpdatedAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, ConfigKey(instanceId), StdLib.Serialize(config));
            OnInstanceStatusChanged(instanceId, active);
        }

        #endregion

        #region Oracle Request Submission

        /// <summary>
        /// Submit an oracle request on behalf of an instance.
        /// Only instance controller may call this.
        ///
        /// The request is forwarded to the configured Morpheus Oracle via
        /// the standard requestFromCallback interface. The oracle will call back
        /// OnOracleResult on this contract with the result.
        /// </summary>
        /// <returns>The unique request ID assigned to this oracle request.</returns>
        public static BigInteger RequestOracle(
            string instanceId,
            string requestType,
            ByteString payload)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateRequestType(requestType);

            InstanceConfig config = GetInstanceConfig(instanceId);
            RequireActiveInstance(config);
            ExecutionEngine.Assert(IsInstanceController(config), "unauthorized: not instance controller");

            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");

            BigInteger requestId = GetNextRequestId();

            // Store request record
            OracleRequest request = new OracleRequest
            {
                RequestId = requestId,
                InstanceId = instanceId,
                RequestType = requestType,
                Payload = payload ?? (ByteString)"",
                Requester = Runtime.Transaction.Sender,
                Status = STATUS_PENDING,
                Result = (ByteString)"",
                Error = "",
                RequestedAt = Runtime.Time,
                FulfilledAt = 0
            };
            Storage.Put(Storage.CurrentContext, RequestKey(requestId), StdLib.Serialize(request));

            // Forward to Morpheus Oracle
            Contract.Call(
                oracle,
                "requestFromCallback",
                CallFlags.All,
                Runtime.Transaction.Sender,
                requestType,
                payload ?? (ByteString)"",
                Runtime.ExecutingScriptHash,
                "onOracleResult");

            OnOracleRequested(instanceId, requestId, requestType, Runtime.Transaction.Sender);
            return requestId;
        }

        #endregion

        #region Oracle Callback Handler

        /// <summary>
        /// Callback entry point invoked by the Morpheus Oracle.
        /// This method is called by the oracle contract when a result is ready.
        ///
        /// NOTE: The requestId parameter here comes from the oracle's own tracking.
        /// We match it to our internal request by looking up the stored request.
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId,
            string requestType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateOracle();

            // Look up the request
            OracleRequest request = GetRequest(requestId);
            ExecutionEngine.Assert(request.InstanceId.Length > 0, "request not found");
            ExecutionEngine.Assert(request.Status == STATUS_PENDING, "request already fulfilled");

            // Update request status
            request.Status = success ? STATUS_FULFILLED : STATUS_FAILED;
            request.Result = result ?? (ByteString)"";
            request.Error = error ?? "";
            request.FulfilledAt = Runtime.Time;
            Storage.Put(Storage.CurrentContext, RequestKey(requestId), StdLib.Serialize(request));

            // Store as latest result for this instance + type
            OracleResult latestResult = new OracleResult
            {
                RequestId = requestId,
                RequestType = requestType ?? "",
                Success = success,
                Data = result ?? (ByteString)"",
                Error = error ?? "",
                Timestamp = Runtime.Time
            };
            Storage.Put(Storage.CurrentContext,
                LatestResultKey(request.InstanceId, requestType ?? ""),
                StdLib.Serialize(latestResult));

            OnOracleCallbackReceived(request.InstanceId, requestId, requestType ?? "", success);

            // Forward to instance callback contract if configured
            InstanceConfig config = GetInstanceConfig(request.InstanceId);
            if (config.CallbackContract != UInt160.Zero &&
                config.CallbackContract.IsValid &&
                config.CallbackMethod.Length > 0)
            {
                Contract.Call(
                    config.CallbackContract,
                    config.CallbackMethod,
                    CallFlags.All,
                    request.InstanceId,
                    requestId,
                    requestType ?? "",
                    success,
                    result ?? (ByteString)"",
                    error ?? "");

                OnOracleResultForwarded(
                    request.InstanceId, requestId,
                    config.CallbackContract, config.CallbackMethod);
            }
        }

        #endregion

        #region Admin Management

        /// <summary>
        /// Set the Morpheus Oracle contract address.
        /// Only admin may call.
        /// </summary>
        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle, "oracle");
            UInt160 oldOracle = Oracle();
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
            OnOracleAddressChanged(oldOracle, oracle);
        }

        public static void SetInstanceRegistry(UInt160 registry)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "admin");
            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        #endregion
    }
}
