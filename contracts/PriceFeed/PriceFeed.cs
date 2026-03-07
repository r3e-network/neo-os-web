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
        private const int MAX_SYMBOL_LENGTH = 32;
        private const int ATTESTATION_HASH_LENGTH = 32;

        public struct PriceRecord
        {
            public BigInteger RoundId;
            public BigInteger Price;
            public ulong Timestamp;
            public ByteString AttestationHash;
            public BigInteger SourceSetId;
        }

        [DisplayName("PriceUpdated")]
        public static event PriceUpdatedHandler OnPriceUpdated = delegate { };

        [DisplayName("BatchPriceUpdated")]
        public static event BatchPriceUpdatedHandler OnBatchPriceUpdated = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        public static void SetUpdater(UInt160 updater)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(updater != UInt160.Zero && updater.IsValid, "invalid updater");
            Storage.Put(Storage.CurrentContext, PREFIX_UPDATER, (ByteString)updater);
        }

        public static UInt160 Updater()
        {
            return ReadAddress(PREFIX_UPDATER);
        }

        private static void ValidateUpdater()
        {
            UInt160 updater = Updater();
            ExecutionEngine.Assert(updater != UInt160.Zero && updater.IsValid, "updater not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(updater), "unauthorized");
        }

        private static StorageMap PriceMap() => new StorageMap(Storage.CurrentContext, PREFIX_PRICE);

        public static PriceRecord GetLatest(string symbol)
        {
            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            string normalizedSymbol = symbol ?? "";
            ExecutionEngine.Assert(normalizedSymbol.Length <= MAX_SYMBOL_LENGTH, "symbol too long");

            ByteString? raw = PriceMap().Get(normalizedSymbol);
            if (raw == null)
            {
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
            ExecutionEngine.Assert(timestamp > 0, "timestamp required");
            ExecutionEngine.Assert(roundId > 0, "roundId required");
            ExecutionEngine.Assert(price > 0, "price required");
            ExecutionEngine.Assert(attestationHash != null && attestationHash.Length == ATTESTATION_HASH_LENGTH, "invalid attestation hash");

            string normalizedSymbol = symbol ?? "";
            ByteString normalizedAttestationHash = attestationHash ?? (ByteString)"";
            ExecutionEngine.Assert(normalizedSymbol.Length <= MAX_SYMBOL_LENGTH, "symbol too long");

            PriceRecord current = GetLatest(normalizedSymbol);
            if (current.RoundId > 0)
            {
                ExecutionEngine.Assert(roundId > current.RoundId, "roundId must be monotonic");
            }

            PriceRecord next = new PriceRecord
            {
                RoundId = roundId,
                Price = price,
                Timestamp = timestamp,
                AttestationHash = normalizedAttestationHash,
                SourceSetId = sourceSetId
            };

            PriceMap().Put(normalizedSymbol, StdLib.Serialize(next));
            OnPriceUpdated(normalizedSymbol, roundId, price, timestamp, normalizedAttestationHash, sourceSetId);
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

            ExecutionEngine.Assert(symbols != null, "symbols required");
            ExecutionEngine.Assert(roundIds != null, "roundIds required");
            ExecutionEngine.Assert(prices != null, "prices required");
            ExecutionEngine.Assert(timestamps != null, "timestamps required");
            ExecutionEngine.Assert(attestationHashes != null, "attestationHashes required");
            ExecutionEngine.Assert(sourceSetIds != null, "sourceSetIds required");
            ExecutionEngine.Assert(batchAttestationHash != null && batchAttestationHash.Length == ATTESTATION_HASH_LENGTH, "invalid batch attestation");

            string[] safeSymbols = symbols ?? new string[0];
            BigInteger[] safeRoundIds = roundIds ?? new BigInteger[0];
            BigInteger[] safePrices = prices ?? new BigInteger[0];
            ulong[] safeTimestamps = timestamps ?? new ulong[0];
            ByteString[] safeAttestationHashes = attestationHashes ?? new ByteString[0];
            BigInteger[] safeSourceSetIds = sourceSetIds ?? new BigInteger[0];
            ByteString normalizedBatchAttestationHash = batchAttestationHash ?? (ByteString)"";

            int count = safeSymbols.Length;
            ExecutionEngine.Assert(count > 0, "empty batch");
            ExecutionEngine.Assert(count <= 100, "batch too large");
            ExecutionEngine.Assert(safeRoundIds.Length == count, "roundIds length mismatch");
            ExecutionEngine.Assert(safePrices.Length == count, "prices length mismatch");
            ExecutionEngine.Assert(safeTimestamps.Length == count, "timestamps length mismatch");
            ExecutionEngine.Assert(safeAttestationHashes.Length == count, "attestationHashes length mismatch");
            ExecutionEngine.Assert(safeSourceSetIds.Length == count, "sourceSetIds length mismatch");

            ulong batchTimestamp = 0;
            StorageMap priceMap = PriceMap();

            for (int i = 0; i < count; i++)
            {
                string symbol = safeSymbols[i] ?? "";
                BigInteger roundId = safeRoundIds[i];
                BigInteger currentPrice = safePrices[i];
                ulong timestamp = safeTimestamps[i];
                ByteString attestationHash = safeAttestationHashes[i] ?? (ByteString)"";
                BigInteger sourceSetId = safeSourceSetIds[i];

                ExecutionEngine.Assert(symbol.Length > 0, "symbol required");
                ExecutionEngine.Assert(symbol.Length <= MAX_SYMBOL_LENGTH, "symbol too long");
                ExecutionEngine.Assert(roundId > 0, "roundId required");
                ExecutionEngine.Assert(currentPrice > 0, "price required");
                ExecutionEngine.Assert(timestamp > 0, "timestamp required");
                ExecutionEngine.Assert(attestationHash.Length == ATTESTATION_HASH_LENGTH, "invalid attestation hash");

                ByteString? raw = priceMap.Get(symbol);
                if (raw != null)
                {
                    PriceRecord current = (PriceRecord)StdLib.Deserialize(raw);
                    if (current.RoundId > 0)
                    {
                        ExecutionEngine.Assert(roundId > current.RoundId, "roundId must be monotonic");
                    }
                }

                PriceRecord next = new PriceRecord
                {
                    RoundId = roundId,
                    Price = currentPrice,
                    Timestamp = timestamp,
                    AttestationHash = attestationHash,
                    SourceSetId = sourceSetId
                };
                priceMap.Put(symbol, StdLib.Serialize(next));

                OnPriceUpdated(symbol, roundId, currentPrice, timestamp, attestationHash, sourceSetId);

                if (timestamp > batchTimestamp)
                {
                    batchTimestamp = timestamp;
                }
            }

            OnBatchPriceUpdated(count, batchTimestamp, normalizedBatchAttestationHash);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
        }

        public static void UpdateContract(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }
    }
}
