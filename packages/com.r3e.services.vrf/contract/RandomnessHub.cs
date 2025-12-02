using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// RandomnessHub tracks VRF/randomness requests and fulfillment.
    /// Inherits from ServiceContractBase for standardized request lifecycle and TEE integration.
    ///
    /// Request Types:
    /// - 0x01: Standard VRF request
    /// - 0x02: Batch VRF request
    ///
    /// Response Types:
    /// - 0x01: VRF output with proof
    /// - 0x02: Batch VRF outputs
    /// </summary>
    public class RandomnessHub : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap VRFRequests = new(Storage.CurrentContext, "vrf:");
        private static readonly StorageMap VRFOutputs = new(Storage.CurrentContext, "vrfout:");

        // Request types
        public const byte RequestTypeStandard = 0x01;
        public const byte RequestTypeBatch = 0x02;

        // Response types
        public const byte ResponseTypeVRF = 0x01;
        public const byte ResponseTypeBatch = 0x02;

        // Service-specific events
        public static event Action<ByteString, ByteString, ByteString> RandomnessRequested;
        public static event Action<ByteString, ByteString, ByteString> RandomnessFulfilled;

        /// <summary>
        /// VRF-specific request data.
        /// </summary>
        public struct VRFRequestData
        {
            public ByteString RequestId;
            public ByteString SeedHash;
            public BigInteger NumWords;
            public ByteString CallbackHash;
            public ByteString CallbackMethod;
        }

        /// <summary>
        /// VRF output data.
        /// </summary>
        public struct VRFOutput
        {
            public ByteString RequestId;
            public ByteString Output;
            public ByteString Proof;
            public ByteString EnclaveKeyId;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.vrf";
        }

        protected override byte GetRequiredRole()
        {
            return RoleRandomnessRunner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != RequestTypeStandard && requestType != RequestTypeBatch)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Request randomness with standard lifecycle.
        /// Uses ServiceContractBase for request management.
        /// </summary>
        public static ByteString RequestRandomness(
            ByteString seedHash,
            BigInteger numWords,
            BigInteger ttlSeconds,
            ByteString callbackHash,
            ByteString callbackMethod)
        {
            if (seedHash is null || seedHash.Length == 0)
            {
                throw new Exception("Seed hash required");
            }
            if (numWords <= 0 || numWords > 10)
            {
                throw new Exception("NumWords must be 1-10");
            }

            // Create VRF-specific payload
            var vrfData = new VRFRequestData
            {
                SeedHash = seedHash,
                NumWords = numWords,
                CallbackHash = callbackHash,
                CallbackMethod = callbackMethod
            };
            var payload = StdLib.Serialize(vrfData);

            // Submit via base class
            var requestId = SubmitRequestInternal(
                (ByteString)"com.r3e.services.vrf",
                RequestTypeStandard,
                payload,
                ttlSeconds,
                callbackHash,
                callbackMethod
            );

            // Store VRF-specific data
            vrfData.RequestId = requestId;
            VRFRequests.Put(requestId, StdLib.Serialize(vrfData));

            RandomnessRequested(requestId, (ByteString)"com.r3e.services.vrf", seedHash);

            return requestId;
        }

        /// <summary>
        /// Fulfill randomness request with enclave verification.
        /// Called by VRF runner after TEE execution.
        /// </summary>
        public static void FulfillRandomness(
            ByteString requestId,
            ByteString output,
            ByteString proof,
            ByteString signature,
            ByteString enclaveKeyId)
        {
            // Verify and fulfill via base class with enclave verification
            FulfillRequestWithEnclaveVerification(
                requestId,
                ResponseTypeVRF,
                output,
                signature,
                enclaveKeyId,
                proof,
                RoleRandomnessRunner
            );

            // Store VRF output
            var vrfOutput = new VRFOutput
            {
                RequestId = requestId,
                Output = output,
                Proof = proof,
                EnclaveKeyId = enclaveKeyId
            };
            VRFOutputs.Put(requestId, StdLib.Serialize(vrfOutput));

            RandomnessFulfilled(requestId, (ByteString)"com.r3e.services.vrf", output);
        }

        /// <summary>
        /// Fulfill randomness without enclave verification (legacy mode).
        /// </summary>
        public static void FulfillRandomnessLegacy(
            ByteString requestId,
            ByteString output,
            ByteString proof,
            ByteString signature,
            ByteString publicKey)
        {
            FulfillRequestInternal(
                requestId,
                ResponseTypeVRF,
                output,
                signature,
                publicKey,
                proof,
                RoleRandomnessRunner
            );

            var vrfOutput = new VRFOutput
            {
                RequestId = requestId,
                Output = output,
                Proof = proof
            };
            VRFOutputs.Put(requestId, StdLib.Serialize(vrfOutput));

            RandomnessFulfilled(requestId, (ByteString)"com.r3e.services.vrf", output);
        }

        /// <summary>
        /// Fail a randomness request.
        /// </summary>
        public static void FailRandomness(ByteString requestId, int errorCode, string errorMessage)
        {
            FailRequestInternal(requestId, errorCode, errorMessage, RoleRandomnessRunner);
        }

        /// <summary>
        /// Cancel a pending randomness request.
        /// </summary>
        public static void CancelRandomness(ByteString requestId)
        {
            CancelRequestInternal(requestId);
        }

        // ============================================================
        // Query Methods
        // ============================================================

        /// <summary>
        /// Get VRF request data.
        /// </summary>
        public static VRFRequestData GetVRFRequest(ByteString requestId)
        {
            var data = VRFRequests.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("VRF request not found");
            }
            return (VRFRequestData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get VRF output.
        /// </summary>
        public static VRFOutput GetVRFOutput(ByteString requestId)
        {
            var data = VRFOutputs.Get(requestId);
            if (data is null || data.Length == 0)
            {
                throw new Exception("VRF output not found");
            }
            return (VRFOutput)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Verify VRF output signature.
        /// </summary>
        public static bool VerifyVRFOutput(ByteString requestId)
        {
            return VerifyResponseSignature(requestId);
        }
    }
}
