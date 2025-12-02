using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// SecretsVault stores references to secrets (never plaintext) with ACL bits.
    /// Inherits from ServiceContractBase for standardized access control and TEE integration.
    ///
    /// ACL Flags:
    /// - 0x01: Allow Oracle service access
    /// - 0x02: Allow Automation service access
    /// - 0x04: Allow Functions service access
    /// - 0x08: Allow CRE/JAM service access
    /// - 0x10: Allow VRF service access
    /// </summary>
    public class SecretsVault : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Secrets = new(Storage.CurrentContext, "sec:");
        private static readonly StorageMap SecretVersions = new(Storage.CurrentContext, "secv:");
        private static readonly StorageMap SecretACL = new(Storage.CurrentContext, "acl:");

        // ACL flags
        public const byte ACLOracle = 0x01;
        public const byte ACLAutomation = 0x02;
        public const byte ACLFunctions = 0x04;
        public const byte ACLCRE = 0x08;
        public const byte ACLVRF = 0x10;
        public const byte ACLAll = 0xFF;

        // Request types
        public const byte RequestTypeStore = 0x01;
        public const byte RequestTypeAccess = 0x02;
        public const byte RequestTypeDelete = 0x03;

        // Service-specific events
        public static event Action<ByteString, UInt160, byte> SecretStored;
        public static event Action<ByteString, UInt160, ByteString> SecretAccessed;
        public static event Action<ByteString, UInt160> SecretDeleted;
        public static event Action<ByteString, byte> SecretACLUpdated;

        /// <summary>
        /// Secret metadata (never contains plaintext).
        /// </summary>
        public struct Secret
        {
            public ByteString Id;
            public UInt160 Owner;
            public ByteString RefHash;      // Reference to encrypted secret in TEE
            public byte ACL;                // Access control flags
            public BigInteger Version;      // Version number
            public BigInteger CreatedAt;
            public BigInteger UpdatedAt;
            public ByteString EnclaveKeyId; // Enclave key used for encryption
        }

        /// <summary>
        /// Secret access log entry.
        /// </summary>
        public struct SecretAccessLog
        {
            public ByteString SecretId;
            public ByteString ServiceId;
            public ByteString RequestId;
            public BigInteger Timestamp;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.secrets";
        }

        protected override byte GetRequiredRole()
        {
            return RoleServiceRunner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != RequestTypeStore &&
                requestType != RequestTypeAccess &&
                requestType != RequestTypeDelete)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Store a secret reference.
        /// The actual secret is encrypted and stored in the TEE enclave.
        /// </summary>
        public static void Store(
            ByteString id,
            UInt160 owner,
            ByteString refHash,
            byte acl,
            ByteString enclaveKeyId)
        {
            RequireOwner(owner);

            if (id is null || id.Length == 0)
            {
                throw new Exception("Secret ID required");
            }
            if (refHash is null || refHash.Length == 0)
            {
                throw new Exception("Reference hash required");
            }

            // Check if secret exists
            var existingData = Secrets.Get(id);
            BigInteger version = 1;
            if (existingData is not null && existingData.Length > 0)
            {
                var existing = (Secret)StdLib.Deserialize(existingData);
                // Only owner can update
                if (existing.Owner != owner)
                {
                    throw new Exception("Not secret owner");
                }
                version = existing.Version + 1;
            }

            var secret = new Secret
            {
                Id = id,
                Owner = owner,
                RefHash = refHash,
                ACL = acl,
                Version = version,
                CreatedAt = version == 1 ? Runtime.Time : ((Secret)StdLib.Deserialize(existingData)).CreatedAt,
                UpdatedAt = Runtime.Time,
                EnclaveKeyId = enclaveKeyId
            };

            Secrets.Put(id, StdLib.Serialize(secret));
            SecretStored(id, owner, acl);
        }

        /// <summary>
        /// Get secret metadata (not the actual secret value).
        /// </summary>
        public static Secret Get(ByteString id)
        {
            var data = Secrets.Get(id);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Secret not found");
            }
            return (Secret)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Request access to a secret for a service.
        /// Returns the reference hash if access is granted.
        /// </summary>
        public static ByteString RequestAccess(
            ByteString secretId,
            ByteString serviceId,
            ByteString requestId)
        {
            var secret = Get(secretId);

            // Check ACL based on service
            if (!CheckServiceACL(secret.ACL, serviceId))
            {
                throw new Exception("Access denied by ACL");
            }

            // Log access
            SecretAccessed(secretId, secret.Owner, serviceId);

            return secret.RefHash;
        }

        /// <summary>
        /// Update secret ACL.
        /// </summary>
        public static void UpdateACL(ByteString id, byte newACL)
        {
            var secret = Get(id);
            RequireOwner(secret.Owner);

            secret.ACL = newACL;
            secret.UpdatedAt = Runtime.Time;
            Secrets.Put(id, StdLib.Serialize(secret));

            SecretACLUpdated(id, newACL);
        }

        /// <summary>
        /// Delete a secret.
        /// </summary>
        public static void Delete(ByteString id)
        {
            var secret = Get(id);
            RequireOwner(secret.Owner);

            Secrets.Delete(id);
            SecretDeleted(id, secret.Owner);
        }

        /// <summary>
        /// Check if a secret exists.
        /// </summary>
        public static bool Exists(ByteString id)
        {
            var data = Secrets.Get(id);
            return data is not null && data.Length > 0;
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static void RequireOwner(UInt160 owner)
        {
            if (owner is null || !owner.IsValid || !Runtime.CheckWitness(owner))
            {
                throw new Exception("Owner required");
            }
        }

        private static bool CheckServiceACL(byte acl, ByteString serviceId)
        {
            // Check if service has access based on ACL flags
            string service = (string)serviceId;

            if (service.Contains("oracle") && (acl & ACLOracle) == 0)
                return false;
            if (service.Contains("automation") && (acl & ACLAutomation) == 0)
                return false;
            if (service.Contains("functions") && (acl & ACLFunctions) == 0)
                return false;
            if (service.Contains("cre") && (acl & ACLCRE) == 0)
                return false;
            if (service.Contains("vrf") && (acl & ACLVRF) == 0)
                return false;

            return true;
        }
    }
}
