using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// ServiceContractBase provides standard interfaces and workflows for all service contracts.
    ///
    /// Architecture:
    /// - All service contracts inherit from this base class
    /// - Standardized request/response lifecycle
    /// - Unified event emission format for Service Layer
    /// - Role-based access control via Manager contract
    /// - TEE/Enclave SDK integration for signature verification
    /// - Pause/unpause functionality
    ///
    /// Event Format (Standard):
    /// - ServiceRequest: (requestId, serviceId, requestType, payload, timestamp)
    /// - ServiceResponse: (requestId, serviceId, responseType, result, signature, timestamp)
    /// - ServiceError: (requestId, serviceId, errorCode, errorMessage, timestamp)
    ///
    /// Enclave SDK Integration:
    /// - Stores registered enclave public keys
    /// - Verifies TEE signatures on responses
    /// - Supports attestation report verification
    /// </summary>
    public abstract class ServiceContractBase : SmartContract
    {
        // ============================================================
        // Storage Maps
        // ============================================================

        protected static readonly StorageMap Requests = new(Storage.CurrentContext, "req:");
        protected static readonly StorageMap Responses = new(Storage.CurrentContext, "res:");
        protected static readonly StorageMap ServiceConfig = new(Storage.CurrentContext, "cfg:");
        protected static readonly StorageMap Nonces = new(Storage.CurrentContext, "nonce:");

        // TEE/Enclave SDK Storage
        protected static readonly StorageMap EnclaveKeys = new(Storage.CurrentContext, "enclave:");
        protected static readonly StorageMap AttestationReports = new(Storage.CurrentContext, "attest:");

        // ============================================================
        // Standard Role Constants (aligned with Manager.cs)
        // ============================================================

        protected const byte RoleAdmin = 0x01;
        protected const byte RoleScheduler = 0x02;
        protected const byte RoleOracleRunner = 0x04;
        protected const byte RoleRandomnessRunner = 0x08;
        protected const byte RoleJamRunner = 0x10;
        protected const byte RoleDataFeedSigner = 0x20;
        protected const byte RoleServiceRunner = 0x40;  // Generic service runner
        protected const byte RoleEnclaveOperator = 0x80; // TEE enclave operator

        // ============================================================
        // Request Status Constants
        // ============================================================

        public const byte StatusPending = 0x00;
        public const byte StatusProcessing = 0x01;
        public const byte StatusFulfilled = 0x02;
        public const byte StatusFailed = 0x03;
        public const byte StatusCancelled = 0x04;
        public const byte StatusExpired = 0x05;

        // ============================================================
        // Enclave Key Status Constants
        // ============================================================

        public const byte EnclaveKeyActive = 0x01;
        public const byte EnclaveKeyRevoked = 0x02;
        public const byte EnclaveKeyExpired = 0x03;

        // ============================================================
        // Standard Events (Service Layer Integration)
        // ============================================================

        /// <summary>
        /// Emitted when a new service request is submitted.
        /// Service Layer listens for this event to trigger processing.
        /// </summary>
        public static event Action<ByteString, ByteString, byte, ByteString, BigInteger> ServiceRequest;

        /// <summary>
        /// Emitted when a service request is fulfilled.
        /// Contains the result and TEE signature for verification.
        /// </summary>
        public static event Action<ByteString, ByteString, byte, ByteString, ByteString, BigInteger> ServiceResponse;

        /// <summary>
        /// Emitted when a service request fails.
        /// Contains error code and message for debugging.
        /// </summary>
        public static event Action<ByteString, ByteString, int, string, BigInteger> ServiceError;

        /// <summary>
        /// Emitted when service configuration changes.
        /// </summary>
        public static event Action<ByteString, string, ByteString> ServiceConfigUpdated;

        /// <summary>
        /// Emitted when an enclave key is registered.
        /// </summary>
        public static event Action<ByteString, ByteString, ByteString, BigInteger> EnclaveKeyRegistered;

        /// <summary>
        /// Emitted when an enclave key is revoked.
        /// </summary>
        public static event Action<ByteString, ByteString, BigInteger> EnclaveKeyRevoked;

        /// <summary>
        /// Emitted when an attestation report is submitted.
        /// </summary>
        public static event Action<ByteString, ByteString, ByteString, BigInteger> AttestationReportSubmitted;

        // ============================================================
        // Standard Request Structure
        // ============================================================

        public struct ServiceRequestData
        {
            public ByteString RequestId;      // Unique request identifier
            public ByteString ServiceId;      // Service package identifier
            public ByteString CallerId;       // Caller's account/contract hash
            public byte RequestType;          // Service-specific request type
            public ByteString Payload;        // Request payload (serialized)
            public byte Status;               // Current status
            public BigInteger CreatedAt;      // Request creation timestamp
            public BigInteger ExpiresAt;      // Request expiration timestamp
            public BigInteger ProcessedAt;    // Processing completion timestamp
            public ByteString CallbackHash;   // Optional callback contract hash
            public ByteString CallbackMethod; // Optional callback method name
        }

        // ============================================================
        // Standard Response Structure
        // ============================================================

        public struct ServiceResponseData
        {
            public ByteString RequestId;      // Reference to request
            public byte ResponseType;         // Service-specific response type
            public ByteString Result;         // Response result (serialized)
            public ByteString Signature;      // TEE signature for verification
            public ByteString PublicKey;      // TEE public key
            public BigInteger Timestamp;      // Response timestamp
            public ByteString Proof;          // Optional execution proof
            public ByteString EnclaveId;      // Enclave identifier
        }

        // ============================================================
        // Enclave Key Structure (SDK Integration)
        // ============================================================

        public struct EnclaveKeyData
        {
            public ByteString KeyId;          // Unique key identifier
            public ByteString PublicKey;      // ECDSA public key (65 bytes, uncompressed)
            public ByteString EnclaveId;      // Enclave identifier (MRENCLAVE hash)
            public ByteString ServiceId;      // Associated service
            public byte Status;               // Key status
            public BigInteger RegisteredAt;   // Registration timestamp
            public BigInteger ExpiresAt;      // Expiration timestamp (0 = no expiry)
            public ByteString AttestationHash; // Hash of attestation report
        }

        // ============================================================
        // Attestation Report Structure
        // ============================================================

        public struct AttestationReportData
        {
            public ByteString ReportId;       // Unique report identifier
            public ByteString EnclaveId;      // Enclave identifier
            public ByteString MrEnclave;      // MRENCLAVE measurement
            public ByteString MrSigner;       // MRSIGNER measurement
            public ByteString ReportData;     // User data in report
            public ByteString Signature;      // Report signature
            public BigInteger Timestamp;      // Report timestamp
            public bool Verified;             // Verification status
        }

        // ============================================================
        // Abstract Methods (Must be implemented by derived contracts)
        // ============================================================

        /// <summary>
        /// Returns the service identifier for this contract.
        /// </summary>
        protected abstract ByteString GetServiceId();

        /// <summary>
        /// Returns the required role for running this service.
        /// </summary>
        protected abstract byte GetRequiredRole();

        /// <summary>
        /// Validates the request payload before processing.
        /// </summary>
        protected abstract bool ValidateRequest(byte requestType, ByteString payload);

        // ============================================================
        // Enclave Key Management (SDK Integration)
        // ============================================================

        /// <summary>
        /// Register a new enclave public key.
        /// Called by enclave operator after TEE attestation.
        /// </summary>
        public static ByteString RegisterEnclaveKey(
            ByteString publicKey,
            ByteString enclaveId,
            ByteString serviceId,
            BigInteger expiresAt,
            ByteString attestationHash)
        {
            RequireRole(RoleEnclaveOperator);

            // Validate public key format (65 bytes uncompressed ECDSA)
            if (publicKey is null || publicKey.Length != 65)
            {
                throw new Exception("Invalid public key format");
            }

            // Generate key ID
            var keyId = GenerateKeyId(publicKey, enclaveId);

            // Check if key already exists
            if (EnclaveKeys.Get(keyId) is not null)
            {
                throw new Exception("Enclave key already registered");
            }

            var keyData = new EnclaveKeyData
            {
                KeyId = keyId,
                PublicKey = publicKey,
                EnclaveId = enclaveId,
                ServiceId = serviceId,
                Status = EnclaveKeyActive,
                RegisteredAt = Runtime.Time,
                ExpiresAt = expiresAt,
                AttestationHash = attestationHash
            };

            EnclaveKeys.Put(keyId, StdLib.Serialize(keyData));

            EnclaveKeyRegistered(keyId, publicKey, enclaveId, Runtime.Time);

            return keyId;
        }

        /// <summary>
        /// Revoke an enclave key.
        /// </summary>
        public static void RevokeEnclaveKey(ByteString keyId)
        {
            RequireRole(RoleEnclaveOperator);

            var data = EnclaveKeys.Get(keyId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Enclave key not found");
            }

            var keyData = (EnclaveKeyData)StdLib.Deserialize(data);
            keyData.Status = EnclaveKeyRevoked;
            EnclaveKeys.Put(keyId, StdLib.Serialize(keyData));

            EnclaveKeyRevoked(keyId, keyData.EnclaveId, Runtime.Time);
        }

        /// <summary>
        /// Get enclave key data.
        /// </summary>
        public static EnclaveKeyData GetEnclaveKey(ByteString keyId)
        {
            var data = EnclaveKeys.Get(keyId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Enclave key not found");
            }
            return (EnclaveKeyData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check if enclave key is valid (active and not expired).
        /// </summary>
        public static bool IsEnclaveKeyValid(ByteString keyId)
        {
            var data = EnclaveKeys.Get(keyId);
            if (data is null || data.Length == 0) return false;

            var keyData = (EnclaveKeyData)StdLib.Deserialize(data);

            if (keyData.Status != EnclaveKeyActive) return false;
            if (keyData.ExpiresAt > 0 && Runtime.Time > keyData.ExpiresAt) return false;

            return true;
        }

        /// <summary>
        /// Verify a signature from an enclave.
        /// Uses ECDSA verification with the registered public key.
        /// </summary>
        public static bool VerifyEnclaveSignature(ByteString keyId, ByteString message, ByteString signature)
        {
            if (!IsEnclaveKeyValid(keyId))
            {
                return false;
            }

            var keyData = GetEnclaveKey(keyId);

            // Verify ECDSA signature
            // Note: Neo uses secp256r1 (P-256) curve
            return CryptoLib.VerifyWithECDsa(message, keyData.PublicKey, signature, NamedCurve.secp256r1);
        }

        /// <summary>
        /// Find enclave key by public key.
        /// </summary>
        public static ByteString FindEnclaveKeyByPublicKey(ByteString publicKey, ByteString enclaveId)
        {
            return GenerateKeyId(publicKey, enclaveId);
        }

        // ============================================================
        // Attestation Report Management
        // ============================================================

        /// <summary>
        /// Submit an attestation report for verification.
        /// </summary>
        public static ByteString SubmitAttestationReport(
            ByteString enclaveId,
            ByteString mrEnclave,
            ByteString mrSigner,
            ByteString reportData,
            ByteString signature)
        {
            RequireRole(RoleEnclaveOperator);

            var reportId = GenerateReportId(enclaveId, mrEnclave);

            var report = new AttestationReportData
            {
                ReportId = reportId,
                EnclaveId = enclaveId,
                MrEnclave = mrEnclave,
                MrSigner = mrSigner,
                ReportData = reportData,
                Signature = signature,
                Timestamp = Runtime.Time,
                Verified = false
            };

            AttestationReports.Put(reportId, StdLib.Serialize(report));

            AttestationReportSubmitted(reportId, enclaveId, mrEnclave, Runtime.Time);

            return reportId;
        }

        /// <summary>
        /// Mark attestation report as verified.
        /// Called after off-chain verification by Intel Attestation Service.
        /// </summary>
        public static void VerifyAttestationReport(ByteString reportId)
        {
            RequireAdmin();

            var data = AttestationReports.Get(reportId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Attestation report not found");
            }

            var report = (AttestationReportData)StdLib.Deserialize(data);
            report.Verified = true;
            AttestationReports.Put(reportId, StdLib.Serialize(report));
        }

        /// <summary>
        /// Get attestation report.
        /// </summary>
        public static AttestationReportData GetAttestationReport(ByteString reportId)
        {
            var data = AttestationReports.Get(reportId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Attestation report not found");
            }
            return (AttestationReportData)StdLib.Deserialize(data);
        }

        // ============================================================
        // Standard Request Lifecycle
        // ============================================================

        /// <summary>
        /// Submit a new service request.
        /// </summary>
        protected static ByteString SubmitRequestInternal(
            ByteString serviceId,
            byte requestType,
            ByteString payload,
            BigInteger ttlSeconds,
            ByteString callbackHash,
            ByteString callbackMethod)
        {
            RequireNotPaused();

            // Generate unique request ID
            var nonce = GetAndIncrementNonce();
            var requestId = GenerateRequestId(serviceId, nonce);

            // Validate request doesn't exist
            if (Requests.Get(requestId) is not null)
            {
                throw new Exception("Request already exists");
            }

            var caller = (UInt160)Runtime.CallingScriptHash;
            var now = Runtime.Time;
            var expiresAt = ttlSeconds > 0 ? now + (ttlSeconds * 1000) : 0;

            var request = new ServiceRequestData
            {
                RequestId = requestId,
                ServiceId = serviceId,
                CallerId = (ByteString)caller,
                RequestType = requestType,
                Payload = payload,
                Status = StatusPending,
                CreatedAt = now,
                ExpiresAt = expiresAt,
                ProcessedAt = 0,
                CallbackHash = callbackHash,
                CallbackMethod = callbackMethod
            };

            Requests.Put(requestId, StdLib.Serialize(request));

            // Emit standard event for Service Layer
            ServiceRequest(requestId, serviceId, requestType, payload, now);

            return requestId;
        }

        /// <summary>
        /// Fulfill a service request with enclave signature verification.
        /// Called by Service Layer runner after TEE execution.
        /// </summary>
        protected static void FulfillRequestInternal(
            ByteString requestId,
            byte responseType,
            ByteString result,
            ByteString signature,
            ByteString publicKey,
            ByteString proof,
            byte requiredRole)
        {
            RequireRole(requiredRole);

            var request = LoadRequest(requestId);

            // Validate request state
            if (request.Status != StatusPending && request.Status != StatusProcessing)
            {
                throw new Exception("Invalid request status");
            }

            // Check expiration
            if (request.ExpiresAt > 0 && Runtime.Time > request.ExpiresAt)
            {
                request.Status = StatusExpired;
                Requests.Put(requestId, StdLib.Serialize(request));
                ServiceError(requestId, request.ServiceId, -1, "Request expired", Runtime.Time);
                return;
            }

            // Update request status
            request.Status = StatusFulfilled;
            request.ProcessedAt = Runtime.Time;
            Requests.Put(requestId, StdLib.Serialize(request));

            // Store response
            var response = new ServiceResponseData
            {
                RequestId = requestId,
                ResponseType = responseType,
                Result = result,
                Signature = signature,
                PublicKey = publicKey,
                Timestamp = Runtime.Time,
                Proof = proof,
                EnclaveId = null // Set by caller if needed
            };
            Responses.Put(requestId, StdLib.Serialize(response));

            // Emit standard response event
            ServiceResponse(requestId, request.ServiceId, responseType, result, signature, Runtime.Time);

            // Execute callback if specified
            if (request.CallbackHash is not null && request.CallbackHash.Length > 0)
            {
                ExecuteCallback(request.CallbackHash, request.CallbackMethod, requestId, result);
            }
        }

        /// <summary>
        /// Fulfill a service request with verified enclave signature.
        /// Verifies the signature against a registered enclave key.
        /// </summary>
        protected static void FulfillRequestWithEnclaveVerification(
            ByteString requestId,
            byte responseType,
            ByteString result,
            ByteString signature,
            ByteString enclaveKeyId,
            ByteString proof,
            byte requiredRole)
        {
            RequireRole(requiredRole);

            // Verify enclave signature
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { requestId, responseType, result })
            );

            if (!VerifyEnclaveSignature(enclaveKeyId, (ByteString)messageToVerify, signature))
            {
                throw new Exception("Invalid enclave signature");
            }

            var keyData = GetEnclaveKey(enclaveKeyId);

            var request = LoadRequest(requestId);

            // Validate request state
            if (request.Status != StatusPending && request.Status != StatusProcessing)
            {
                throw new Exception("Invalid request status");
            }

            // Check expiration
            if (request.ExpiresAt > 0 && Runtime.Time > request.ExpiresAt)
            {
                request.Status = StatusExpired;
                Requests.Put(requestId, StdLib.Serialize(request));
                ServiceError(requestId, request.ServiceId, -1, "Request expired", Runtime.Time);
                return;
            }

            // Update request status
            request.Status = StatusFulfilled;
            request.ProcessedAt = Runtime.Time;
            Requests.Put(requestId, StdLib.Serialize(request));

            // Store response with enclave info
            var response = new ServiceResponseData
            {
                RequestId = requestId,
                ResponseType = responseType,
                Result = result,
                Signature = signature,
                PublicKey = keyData.PublicKey,
                Timestamp = Runtime.Time,
                Proof = proof,
                EnclaveId = keyData.EnclaveId
            };
            Responses.Put(requestId, StdLib.Serialize(response));

            // Emit standard response event
            ServiceResponse(requestId, request.ServiceId, responseType, result, signature, Runtime.Time);

            // Execute callback if specified
            if (request.CallbackHash is not null && request.CallbackHash.Length > 0)
            {
                ExecuteCallback(request.CallbackHash, request.CallbackMethod, requestId, result);
            }
        }

        /// <summary>
        /// Mark a request as failed.
        /// </summary>
        protected static void FailRequestInternal(
            ByteString requestId,
            int errorCode,
            string errorMessage,
            byte requiredRole)
        {
            RequireRole(requiredRole);

            var request = LoadRequest(requestId);

            if (request.Status != StatusPending && request.Status != StatusProcessing)
            {
                throw new Exception("Invalid request status");
            }

            request.Status = StatusFailed;
            request.ProcessedAt = Runtime.Time;
            Requests.Put(requestId, StdLib.Serialize(request));

            ServiceError(requestId, request.ServiceId, errorCode, errorMessage, Runtime.Time);
        }

        /// <summary>
        /// Cancel a pending request (only by original caller).
        /// </summary>
        protected static void CancelRequestInternal(ByteString requestId)
        {
            var request = LoadRequest(requestId);

            // Only caller can cancel
            var caller = (UInt160)Runtime.CallingScriptHash;
            if ((ByteString)caller != request.CallerId && !Runtime.CheckWitness(caller))
            {
                throw new Exception("Only caller can cancel");
            }

            if (request.Status != StatusPending)
            {
                throw new Exception("Can only cancel pending requests");
            }

            request.Status = StatusCancelled;
            request.ProcessedAt = Runtime.Time;
            Requests.Put(requestId, StdLib.Serialize(request));
        }

        // ============================================================
        // Query Methods
        // ============================================================

        /// <summary>
        /// Get request by ID.
        /// </summary>
        public static ServiceRequestData GetRequest(ByteString requestId)
        {
            return LoadRequest(requestId);
        }

        /// <summary>
        /// Get response by request ID.
        /// </summary>
        public static ServiceResponseData GetResponse(ByteString requestId)
        {
            var data = Responses.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Response not found");
            }
            return (ServiceResponseData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check if request exists.
        /// </summary>
        public static bool RequestExists(ByteString requestId)
        {
            return Requests.Get(requestId) is not null;
        }

        /// <summary>
        /// Verify a response signature against the stored public key.
        /// </summary>
        public static bool VerifyResponseSignature(ByteString requestId)
        {
            var response = GetResponse(requestId);

            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { response.RequestId, response.ResponseType, response.Result })
            );

            return CryptoLib.VerifyWithECDsa(
                (ByteString)messageToVerify,
                response.PublicKey,
                response.Signature,
                NamedCurve.secp256r1
            );
        }

        // ============================================================
        // Configuration Methods
        // ============================================================

        /// <summary>
        /// Set Manager contract hash.
        /// </summary>
        public static void SetManager(UInt160 hash)
        {
            RequireAdmin();
            if (hash is null || !hash.IsValid)
            {
                throw new Exception("Invalid manager hash");
            }
            ServiceConfig.Put("manager", hash);
        }

        /// <summary>
        /// Get Manager contract hash.
        /// </summary>
        public static UInt160 GetManager()
        {
            var data = ServiceConfig.Get("manager");
            if (data is null || data.Length == 0) return UInt160.Zero;
            return (UInt160)data;
        }

        /// <summary>
        /// Set service configuration value.
        /// </summary>
        public static void SetConfig(string key, ByteString value)
        {
            RequireAdmin();
            ServiceConfig.Put(key, value);
            ServiceConfigUpdated(GetServiceIdStatic(), key, value);
        }

        /// <summary>
        /// Get service configuration value.
        /// </summary>
        public static ByteString GetConfig(string key)
        {
            return ServiceConfig.Get(key);
        }

        /// <summary>
        /// Pause the service.
        /// </summary>
        public static void Pause()
        {
            RequireAdmin();
            ServiceConfig.Put("paused", 1);
        }

        /// <summary>
        /// Unpause the service.
        /// </summary>
        public static void Unpause()
        {
            RequireAdmin();
            ServiceConfig.Put("paused", 0);
        }

        /// <summary>
        /// Check if service is paused.
        /// </summary>
        public static bool IsPaused()
        {
            var val = ServiceConfig.Get("paused");
            return val is not null && val.Length > 0 && (byte)val[0] != 0;
        }

        // ============================================================
        // Access Control Helpers
        // ============================================================

        /// <summary>
        /// Require caller has admin role.
        /// </summary>
        protected static void RequireAdmin()
        {
            RequireRole(RoleAdmin);
        }

        /// <summary>
        /// Require caller has specific role.
        /// </summary>
        protected static void RequireRole(byte role)
        {
            var caller = (UInt160)Runtime.CallingScriptHash;
            if (!HasRole(caller, role) && !Runtime.CheckWitness(caller))
            {
                throw new Exception("Role required: " + role);
            }
        }

        /// <summary>
        /// Check if account has role via Manager contract.
        /// </summary>
        protected static bool HasRole(UInt160 account, byte role)
        {
            var mgr = GetManager();
            if (mgr == UInt160.Zero)
            {
                // No manager set, fall back to witness check
                return Runtime.CheckWitness(account);
            }
            return (bool)Contract.Call(mgr, "HasRole", CallFlags.ReadOnly, account, role);
        }

        /// <summary>
        /// Require service is not paused.
        /// </summary>
        protected static void RequireNotPaused()
        {
            if (IsPaused())
            {
                throw new Exception("Service is paused");
            }
        }

        // ============================================================
        // Internal Helpers
        // ============================================================

        private static ServiceRequestData LoadRequest(ByteString requestId)
        {
            var data = Requests.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Request not found");
            }
            return (ServiceRequestData)StdLib.Deserialize(data);
        }

        private static BigInteger GetAndIncrementNonce()
        {
            var key = (ByteString)"global_nonce";
            var data = Nonces.Get(key);
            BigInteger nonce = data is null || data.Length == 0 ? 0 : (BigInteger)data;
            Nonces.Put(key, nonce + 1);
            return nonce;
        }

        private static ByteString GenerateRequestId(ByteString serviceId, BigInteger nonce)
        {
            var hash = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { serviceId, nonce, Runtime.Time, Runtime.ExecutingScriptHash })
            );
            return (ByteString)hash;
        }

        private static ByteString GenerateKeyId(ByteString publicKey, ByteString enclaveId)
        {
            var hash = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { publicKey, enclaveId })
            );
            return (ByteString)hash;
        }

        private static ByteString GenerateReportId(ByteString enclaveId, ByteString mrEnclave)
        {
            var hash = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { enclaveId, mrEnclave, Runtime.Time })
            );
            return (ByteString)hash;
        }

        private static void ExecuteCallback(ByteString callbackHash, ByteString callbackMethod, ByteString requestId, ByteString result)
        {
            try
            {
                var hash = (UInt160)callbackHash;
                var method = callbackMethod.Length > 0 ? (string)callbackMethod : "onServiceResponse";
                Contract.Call(hash, method, CallFlags.All, requestId, result);
            }
            catch
            {
                // Callback failure should not revert the fulfillment
            }
        }

        // Static helper for event emission (override in derived class)
        private static ByteString GetServiceIdStatic()
        {
            return (ByteString)"base";
        }
    }
}
