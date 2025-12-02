using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace ServiceLayer.Contracts
{
    /// <summary>
    /// JAMInbox stores content-addressed receipts and accumulator roots per service.
    /// Inherits from ServiceContractBase for standardized access control and TEE integration.
    ///
    /// Entry Types:
    /// - 0x01: Package entry
    /// - 0x02: Report entry
    /// </summary>
    public class JAMInbox : ServiceContractBase
    {
        // Service-specific storage
        private static readonly StorageMap Receipts = new(Storage.CurrentContext, "rcpt:");
        private static readonly StorageMap Roots = new(Storage.CurrentContext, "root:");
        private static readonly StorageMap Seq = new(Storage.CurrentContext, "seq:");

        // Entry types
        public const byte EntryTypePackage = 0x01;
        public const byte EntryTypeReport = 0x02;

        // Events
        public static event Action<ByteString, ByteString, BigInteger, ByteString> ReceiptAppended;
        public static event Action<ByteString, ByteString> RootUpdated;

        public struct Receipt
        {
            public ByteString Hash;
            public ByteString ServiceId;
            public byte EntryType;
            public BigInteger Seq;
            public ByteString PrevRoot;
            public ByteString NewRoot;
            public byte Status;
            public BigInteger ProcessedAt;
            public ByteString EnclaveKeyId;
        }

        // ============================================================
        // ServiceContractBase Implementation
        // ============================================================

        protected override ByteString GetServiceId()
        {
            return (ByteString)"com.r3e.services.cre";
        }

        protected override byte GetRequiredRole()
        {
            return RoleJamRunner;
        }

        protected override bool ValidateRequest(byte requestType, ByteString payload)
        {
            if (requestType != EntryTypePackage && requestType != EntryTypeReport)
            {
                return false;
            }
            return payload is not null && payload.Length > 0;
        }

        // ============================================================
        // Public API
        // ============================================================

        /// <summary>
        /// Append a receipt with enclave verification.
        /// </summary>
        public static void AppendReceipt(
            ByteString hash,
            ByteString serviceId,
            byte entryType,
            ByteString prevRoot,
            ByteString newRoot,
            byte status,
            ByteString signature,
            ByteString enclaveKeyId)
        {
            RequireRole(RoleJamRunner);

            if (hash is null || hash.Length == 0)
            {
                throw new Exception("Hash required");
            }
            if (serviceId is null || serviceId.Length == 0)
            {
                throw new Exception("Service ID required");
            }

            // Verify enclave signature
            var messageToVerify = CryptoLib.Sha256(
                StdLib.Serialize(new object[] { hash, serviceId, entryType, prevRoot, newRoot })
            );

            if (!VerifyEnclaveSignature(enclaveKeyId, (ByteString)messageToVerify, signature))
            {
                throw new Exception("Invalid enclave signature");
            }

            var seq = NextSeq(serviceId);

            var receipt = new Receipt
            {
                Hash = hash,
                ServiceId = serviceId,
                EntryType = entryType,
                Seq = seq,
                PrevRoot = prevRoot,
                NewRoot = newRoot,
                Status = status,
                ProcessedAt = Runtime.Time,
                EnclaveKeyId = enclaveKeyId
            };

            Receipts.Put(hash, StdLib.Serialize(receipt));
            Roots.Put(serviceId, newRoot);

            ReceiptAppended(hash, serviceId, seq, newRoot);
            RootUpdated(serviceId, newRoot);
        }

        /// <summary>
        /// Append a receipt without enclave verification (legacy mode).
        /// </summary>
        public static void AppendReceiptLegacy(
            ByteString hash,
            ByteString serviceId,
            byte entryType,
            ByteString prevRoot,
            ByteString newRoot,
            byte status,
            BigInteger processedAt)
        {
            RequireRole(RoleJamRunner);

            if (hash is null || hash.Length == 0)
            {
                throw new Exception("Hash required");
            }
            if (serviceId is null || serviceId.Length == 0)
            {
                throw new Exception("Service ID required");
            }

            var seq = NextSeq(serviceId);

            var receipt = new Receipt
            {
                Hash = hash,
                ServiceId = serviceId,
                EntryType = entryType,
                Seq = seq,
                PrevRoot = prevRoot,
                NewRoot = newRoot,
                Status = status,
                ProcessedAt = processedAt
            };

            Receipts.Put(hash, StdLib.Serialize(receipt));
            Roots.Put(serviceId, newRoot);

            ReceiptAppended(hash, serviceId, seq, newRoot);
        }

        /// <summary>
        /// Get receipt by hash.
        /// </summary>
        public static Receipt GetReceipt(ByteString hash)
        {
            var data = Receipts.Get(hash);
            if (data is null || data.Length == 0)
            {
                throw new Exception("Receipt not found");
            }
            return (Receipt)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Get current root for a service.
        /// </summary>
        public static ByteString GetRoot(ByteString serviceId)
        {
            return Roots.Get(serviceId);
        }

        /// <summary>
        /// Get current sequence number for a service.
        /// </summary>
        public static BigInteger GetSequence(ByteString serviceId)
        {
            var existing = Seq.Get(serviceId);
            if (existing is null || existing.Length == 0)
            {
                return 0;
            }
            return (BigInteger)existing;
        }

        /// <summary>
        /// Check if receipt exists.
        /// </summary>
        public static bool ReceiptExists(ByteString hash)
        {
            var data = Receipts.Get(hash);
            return data is not null && data.Length > 0;
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private static BigInteger NextSeq(ByteString serviceId)
        {
            var existing = Seq.Get(serviceId);
            BigInteger current = 0;
            if (existing is not null && existing.Length > 0)
            {
                current = (BigInteger)existing;
            }
            var next = current + 1;
            Seq.Put(serviceId, next);
            return next;
        }
    }
}
