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
    public delegate void PriceUpdatedHandler(string symbol, BigInteger roundId, BigInteger price, ulong timestamp, ByteString attestationHash, BigInteger sourceSetId);

    // Batch update event - emits count and batch attestation hash
    public delegate void BatchPriceUpdatedHandler(BigInteger count, ulong timestamp, ByteString batchAttestationHash);

    [DisplayName("PriceFeed")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "On-chain price feed anchoring with batch update and attestation")]
    public class PriceFeed : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_UPDATER = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PRICE = new byte[] { 0x03 };

        public struct PriceRecord
        {
            public BigInteger RoundId;
            public BigInteger Price;
            public ulong Timestamp;
            public ByteString AttestationHash;
            public BigInteger SourceSetId;
        }

        [DisplayName("PriceUpdated")]
        public static event PriceUpdatedHandler OnPriceUpdated;

        [DisplayName("BatchPriceUpdated")]
        public static event BatchPriceUpdatedHandler OnBatchPriceUpdated;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
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

        public static void SetUpdater(UInt160 updater)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(updater != null && updater.IsValid, "invalid updater");
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, updater);
        }

        public static UInt160 Updater()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_UPDATER);
        }

        private static void ValidateUpdater()
        {
            UInt160 updater = Updater();
            ExecutionEngine.Assert(updater != null && updater.IsValid, "updater not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(updater), "unauthorized");
        }

        private static StorageMap PriceMap() => new StorageMap(Storage.CurrentContext, PREFIX_PRICE);

        public static PriceRecord GetLatest(string symbol)
        {
            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            ByteString raw = PriceMap().Get(symbol);
            if (raw == null)
            {
                // Avoid returning `default` struct which may be represented as an empty VMArray,
                // causing field access to throw (index out of range) in Neo VM.
                return new PriceRecord
                {
                    RoundId = 0,
                    Price = 0,
                    Timestamp = 0,
                    AttestationHash = (ByteString)"",
                    SourceSetId = 0
                };
            }
            return (PriceRecord)StdLib.Deserialize(raw);
        }

        public static void Update(string symbol, BigInteger roundId, BigInteger price, ulong timestamp, ByteString attestationHash, BigInteger sourceSetId)
        {
            ValidateUpdater();

            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            ExecutionEngine.Assert(roundId > 0, "roundId required");
            ExecutionEngine.Assert(price > 0, "price required");
            ExecutionEngine.Assert(timestamp > 0, "timestamp required");
            ExecutionEngine.Assert(attestationHash != null && attestationHash.Length > 0, "attestation hash required");

            PriceRecord current = GetLatest(symbol);
            if (current.RoundId > 0)
            {
                ExecutionEngine.Assert(roundId > current.RoundId, "roundId must be monotonic");
            }

            PriceRecord next = new PriceRecord
            {
                RoundId = roundId,
                Price = price,
                Timestamp = timestamp,
                AttestationHash = attestationHash,
                SourceSetId = sourceSetId
            };

            PriceMap().Put(symbol, StdLib.Serialize(next));
            OnPriceUpdated(symbol, roundId, price, timestamp, attestationHash, sourceSetId);
        }

        /// <summary>
        /// Batch update multiple price feeds in a single transaction.
        /// All arrays must have the same length.
        /// Emits individual PriceUpdated events for each symbol plus a BatchPriceUpdated summary event.
        /// </summary>
        public static void BatchUpdate(
            string[] symbols,
            BigInteger[] roundIds,
            BigInteger[] prices,
            ulong[] timestamps,
            ByteString[] attestationHashes,
            BigInteger[] sourceSetIds,
            ByteString batchAttestationHash)
        {
            ValidateUpdater();

            int count = symbols.Length;
            ExecutionEngine.Assert(count > 0, "empty batch");
            ExecutionEngine.Assert(roundIds.Length == count, "roundIds length mismatch");
            ExecutionEngine.Assert(prices.Length == count, "prices length mismatch");
            ExecutionEngine.Assert(timestamps.Length == count, "timestamps length mismatch");
            ExecutionEngine.Assert(attestationHashes.Length == count, "attestationHashes length mismatch");
            ExecutionEngine.Assert(sourceSetIds.Length == count, "sourceSetIds length mismatch");
            ExecutionEngine.Assert(batchAttestationHash != null && batchAttestationHash.Length > 0, "batch attestation required");

            ulong batchTimestamp = 0;
            StorageMap priceMap = PriceMap();

            for (int i = 0; i < count; i++)
            {
                string symbol = symbols[i];
                BigInteger roundId = roundIds[i];
                BigInteger price = prices[i];
                ulong timestamp = timestamps[i];
                ByteString attestationHash = attestationHashes[i];
                BigInteger sourceSetId = sourceSetIds[i];

                ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
                ExecutionEngine.Assert(roundId > 0, "roundId required");
                ExecutionEngine.Assert(price > 0, "price required");
                ExecutionEngine.Assert(timestamp > 0, "timestamp required");
                ExecutionEngine.Assert(attestationHash != null && attestationHash.Length > 0, "attestation hash required");

                // Check monotonic roundId
                ByteString raw = priceMap.Get(symbol);
                if (raw != null)
                {
                    PriceRecord current = (PriceRecord)StdLib.Deserialize(raw);
                    if (current.RoundId > 0)
                    {
                        ExecutionEngine.Assert(roundId > current.RoundId, "roundId must be monotonic");
                    }
                }

                // Store the new price record
                PriceRecord next = new PriceRecord
                {
                    RoundId = roundId,
                    Price = price,
                    Timestamp = timestamp,
                    AttestationHash = attestationHash,
                    SourceSetId = sourceSetId
                };
                priceMap.Put(symbol, StdLib.Serialize(next));

                // Emit individual event
                OnPriceUpdated(symbol, roundId, price, timestamp, attestationHash, sourceSetId);

                // Track latest timestamp for batch event
                if (timestamp > batchTimestamp)
                {
                    batchTimestamp = timestamp;
                }
            }

            // Emit batch summary event
            OnBatchPriceUpdated(count, batchTimestamp, batchAttestationHash);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void UpdateContract(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
