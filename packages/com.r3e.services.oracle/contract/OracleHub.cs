using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// OracleHub registers requests and marks fulfillment.
    /// Inherits from ServiceContractBase for standardized request lifecycle and TEE integration.
    ///
    /// Request Types:
    /// - 0x01: HTTP GET request
    /// - 0x02: HTTP POST request
    /// - 0x03: GraphQL query
    ///
    /// Response Types:
    /// - 0x01: JSON response
    /// - 0x02: Binary response
    /// </summary>
    public class OracleHub : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap OracleRequests = new(Storage.CurrentContext, "oracle:");
        private static readonly StorageMap OracleResults = new(Storage.CurrentContext, "result:");

        // Request types
        public const byte RequestTypeHTTPGet = 0x01;
        public const byte RequestTypeHTTPPost = 0x02;
        public const byte RequestTypeGraphQL = 0x03;

        // Response types
        public const byte ResponseTypeJSON = 0x01;
        public const byte ResponseTypeBinary = 0x02;

        // Service-specific events
        public static event Action<ByteString, ByteString, long> OracleRequested;
        public static event Action<ByteString, ByteString> OracleFulfilled;

        /// <summary>
        /// Oracle-specific request data.
        /// </summary>
        public struct OracleRequestData
        {
            public ByteString RequestId;
            public ByteString URL;
            public ByteString Headers;
            public ByteString Body;
            public ByteString JSONPath;
            public long Fee;
        }

        /// <summary>
        /// Oracle result data.
        /// </summary>
        public struct OracleResult
        {
            public ByteString RequestId;
            public ByteString ResultHash;
            public ByteString Result;
            public ByteString EnclaveKeyId;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.oracle";
        }

        protected override byte GetRequiredRole()
        {
            return RoleOracleRunner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != RequestTypeHTTPGet &&
                requestType != RequestTypeHTTPPost &&
                requestType != RequestTypeGraphQL)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Submit an oracle request with standard lifecycle.
        /// </summary>
        public static ByteString SubmitOracleRequest(
            ByteString url,
            byte requestType,
            ByteString headers,
            ByteString body,
            ByteString jsonPath,
            long fee,
            BigInteger ttlSeconds,
            ByteString callbackHash,
            ByteString callbackMethod)
        {
            if (url is null || url.Length == 0)
            {
                throw new Exception("URL required");
            }

            // Create oracle-specific payload
            var oracleData = new OracleRequestData
            {
                URL = url,
                Headers = headers,
                Body = body,
                JSONPath = jsonPath,
                Fee = fee
            };
            var payload = StdLib.Serialize(oracleData);

            // Submit via base class
            var requestId = SubmitRequestInternal(
                (ByteString)"com.r3e.services.oracle",
                requestType,
                payload,
                ttlSeconds,
                callbackHash,
                callbackMethod
            );

            // Store oracle-specific data
            oracleData.RequestId = requestId;
            OracleRequests.Put(requestId, StdLib.Serialize(oracleData));

            OracleRequested(requestId, (ByteString)"com.r3e.services.oracle", fee);

            return requestId;
        }

        /// <summary>
        /// Fulfill oracle request with enclave verification.
        /// </summary>
        public static void FulfillOracle(
            ByteString requestId,
            ByteString result,
            ByteString signature,
            ByteString enclaveKeyId)
        {
            var resultHash = CryptoLib.Sha256(result);

            // Fulfill via base class with enclave verification
            FulfillRequestWithEnclaveVerification(
                requestId,
                ResponseTypeJSON,
                result,
                signature,
                enclaveKeyId,
                (ByteString)resultHash,
                RoleOracleRunner
            );

            // Store oracle result
            var oracleResult = new OracleResult
            {
                RequestId = requestId,
                ResultHash = (ByteString)resultHash,
                Result = result,
                EnclaveKeyId = enclaveKeyId
            };
            OracleResults.Put(requestId, StdLib.Serialize(oracleResult));

            OracleFulfilled(requestId, (ByteString)resultHash);
        }

        /// <summary>
        /// Fulfill oracle request without enclave verification (legacy mode).
        /// </summary>
        public static void FulfillOracleLegacy(
            ByteString requestId,
            ByteString result,
            ByteString signature,
            ByteString publicKey)
        {
            var resultHash = CryptoLib.Sha256(result);

            FulfillRequestInternal(
                requestId,
                ResponseTypeJSON,
                result,
                signature,
                publicKey,
                (ByteString)resultHash,
                RoleOracleRunner
            );

            var oracleResult = new OracleResult
            {
                RequestId = requestId,
                ResultHash = (ByteString)resultHash,
                Result = result
            };
            OracleResults.Put(requestId, StdLib.Serialize(oracleResult));

            OracleFulfilled(requestId, (ByteString)resultHash);
        }

        /// <summary>
        /// Fail an oracle request.
        /// </summary>
        public static void FailOracle(ByteString requestId, int errorCode, string errorMessage)
        {
            FailRequestInternal(requestId, errorCode, errorMessage, RoleOracleRunner);
        }

        /// <summary>
        /// Cancel a pending oracle request.
        /// </summary>
        public static void CancelOracle(ByteString requestId)
        {
            CancelRequestInternal(requestId);
        }

        // ============================================================
        // Query Methods
        // ============================================================

        /// <summary>
        /// Get oracle request data.
        /// </summary>
        public static OracleRequestData GetOracleRequest(ByteString requestId)
        {
            var data = OracleRequests.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Oracle request not found");
            }
            return (OracleRequestData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get oracle result.
        /// </summary>
        public static OracleResult GetOracleResult(ByteString requestId)
        {
            var data = OracleResults.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Oracle result not found");
            }
            return (OracleResult)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Verify oracle result signature.
        /// </summary>
        public static bool VerifyOracleResult(ByteString requestId)
        {
            return VerifyResponseSignature(requestId);
        }
    }
}
