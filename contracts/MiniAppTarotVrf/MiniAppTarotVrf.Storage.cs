using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTarotVrf
    {
        internal static void ValidateAddress(UInt160 value, string message)
        {
            ExecutionEngine.Assert(value is not null && value.IsValid && value != UInt160.Zero, message);
        }

        internal static UInt160 ReadAddress(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        internal static BigInteger ReadInteger(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? 0 : (BigInteger)raw;
        }

        internal static void PutInteger(byte[] key, BigInteger value)
        {
            if (value == 0) Storage.Delete(Storage.CurrentContext, key);
            else Storage.Put(Storage.CurrentContext, key, value);
        }

        internal static byte[] AddressKey(byte[] prefix, UInt160 account) =>
            (byte[])Helper.Concat((ByteString)prefix, (ByteString)(byte[])account);

        internal static byte[] IntegerKey(byte[] prefix, BigInteger value) =>
            (byte[])Helper.Concat((ByteString)prefix, (ByteString)value.ToByteArray());

        internal static byte[] PlayerItemKey(UInt160 player, BigInteger sequence) =>
            (byte[])Helper.Concat(
                (ByteString)AddressKey(PREFIX_PLAYER_ITEM, player),
                (ByteString)sequence.ToByteArray());

        internal static BigInteger CreditOfInternal(UInt160 account)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AddressKey(PREFIX_CREDIT, account));
            return raw == null ? 0 : (BigInteger)raw;
        }

        internal static void SetCredit(UInt160 account, BigInteger amount)
        {
            byte[] key = AddressKey(PREFIX_CREDIT, account);
            if (amount == 0) Storage.Delete(Storage.CurrentContext, key);
            else Storage.Put(Storage.CurrentContext, key, amount);
        }

        internal static BigInteger ActiveReadingInternal(UInt160 player)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AddressKey(PREFIX_ACTIVE_READING, player));
            return raw == null ? 0 : (BigInteger)raw;
        }

        internal static Reading LoadReading(BigInteger readingId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, IntegerKey(PREFIX_READING, readingId));
            if (raw == null)
            {
                return new Reading
                {
                    Player = UInt160.Zero,
                    Oracle = UInt160.Zero,
                    PayloadHash = (ByteString)""
                };
            }
            return (Reading)StdLib.Deserialize(raw);
        }

        internal static void StoreReading(BigInteger readingId, Reading reading) =>
            Storage.Put(Storage.CurrentContext, IntegerKey(PREFIX_READING, readingId), StdLib.Serialize(reading));

        internal static BigInteger ReadingForRequest(BigInteger requestId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, IntegerKey(PREFIX_REQUEST_READING, requestId));
            return raw == null ? 0 : (BigInteger)raw;
        }

        internal static bool RequestIdSeenInternal(BigInteger requestId) =>
            requestId > 0 && Storage.Get(
                Storage.CurrentContext,
                IntegerKey(PREFIX_REQUEST_SEEN, requestId)) != null;

        internal static ByteString BuildRequestPayload(
            BigInteger readingId,
            UInt160 player,
            UInt160 oracle,
            BigInteger network,
            string callbackMethod,
            BigInteger requestedAt) =>
            StdLib.Serialize(new object[]
            {
                PAYLOAD_DOMAIN,
                Runtime.ExecutingScriptHash,
                network,
                oracle,
                REQUEST_TYPE,
                callbackMethod,
                readingId,
                player,
                requestedAt
            });

        internal static ByteString ComputeRequestPayloadHash(
            BigInteger readingId,
            UInt160 player,
            UInt160 oracle,
            BigInteger network,
            string callbackMethod,
            BigInteger requestedAt) =>
            CryptoLib.Sha256(BuildRequestPayload(
                readingId,
                player,
                oracle,
                network,
                callbackMethod,
                requestedAt));

        internal static void RecordPlayerReading(UInt160 player, BigInteger readingId)
        {
            byte[] countKey = AddressKey(PREFIX_PLAYER_COUNT, player);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey) + 1;
            Storage.Put(Storage.CurrentContext, countKey, count);
            Storage.Put(Storage.CurrentContext, PlayerItemKey(player, count), readingId);
        }

        internal static void AcquireLock()
        {
            ValidateNotBusy();
            Storage.Put(Storage.CurrentContext, PREFIX_LOCK, 1);
        }

        internal static void ReleaseLock() => Storage.Delete(Storage.CurrentContext, PREFIX_LOCK);

        internal static void ValidateNotBusy() =>
            ExecutionEngine.Assert(ReadInteger(PREFIX_LOCK) == 0, "contract busy");

        internal static void ValidateAdmin()
        {
            ValidateNotBusy();
            UInt160 admin = Admin();
            ValidateAddress(admin, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "admin only");
        }

        internal static void ValidateConfiguredOracle()
        {
            UInt160 oracle = Oracle();
            ValidateAddress(oracle, "oracle not configured");
        }

        internal static void ValidateStoredPendingBinding(
            BigInteger readingId,
            BigInteger requestId,
            Reading reading)
        {
            ExecutionEngine.Assert(reading.Player != UInt160.Zero, "reading not found");
            ExecutionEngine.Assert(reading.Status == STATUS_PENDING, "reading not pending");
            ExecutionEngine.Assert(reading.RequestId == requestId, "request mismatch");
            ExecutionEngine.Assert(ReadingForRequest(requestId) == readingId, "request binding missing");
            ExecutionEngine.Assert(RequestIdSeenInternal(requestId), "request tombstone missing");
            ExecutionEngine.Assert(
                ActiveReadingInternal(reading.Player) == readingId,
                "active reading mismatch");
            ExecutionEngine.Assert(reading.Oracle == Oracle(), "oracle changed");
            ExecutionEngine.Assert(reading.Network == (BigInteger)Runtime.GetNetwork(), "network mismatch");
            string expectedCallbackMethod = IsLegacyTestnetOracle()
                ? LEGACY_CALLBACK_METHOD
                : RICH_CALLBACK_METHOD;
            ExecutionEngine.Assert(
                reading.CallbackMethod == expectedCallbackMethod,
                "stored callback adapter mismatch");
            ExecutionEngine.Assert(reading.Fee == READING_FEE, "reading fee binding mismatch");
            ExecutionEngine.Assert(
                reading.OracleFee >= 0 && reading.OracleFee <= reading.Fee,
                "oracle fee binding mismatch");
            ExecutionEngine.Assert(reading.RequestedAt > 0, "request time binding missing");

            ByteString expectedPayloadHash = ComputeRequestPayloadHash(
                readingId,
                reading.Player,
                reading.Oracle,
                reading.Network,
                reading.CallbackMethod,
                reading.RequestedAt);
            ExecutionEngine.Assert(
                reading.PayloadHash != null
                    && reading.PayloadHash.Length == 32
                    && reading.PayloadHash == expectedPayloadHash,
                "payload binding mismatch");
        }

        internal static void ValidatePendingBinding(
            BigInteger readingId,
            BigInteger requestId,
            Reading reading,
            string callbackMethod)
        {
            ValidateStoredPendingBinding(readingId, requestId, reading);
            ExecutionEngine.Assert(
                reading.Oracle == Runtime.CallingScriptHash,
                "oracle binding mismatch");
            ExecutionEngine.Assert(
                reading.CallbackMethod == callbackMethod,
                "callback adapter mismatch");
        }

        internal static void ClosePending(BigInteger readingId, BigInteger requestId, Reading reading)
        {
            ExecutionEngine.Assert(PendingCount() > 0, "pending count invariant violated");
            ExecutionEngine.Assert(
                PendingFees() >= reading.Fee,
                "pending fee invariant violated");
            Storage.Delete(Storage.CurrentContext, IntegerKey(PREFIX_REQUEST_READING, requestId));
            Storage.Delete(Storage.CurrentContext, AddressKey(PREFIX_ACTIVE_READING, reading.Player));
            PutInteger(PREFIX_PENDING_COUNT, PendingCount() - 1);
            PutInteger(PREFIX_PENDING_FEES, PendingFees() - reading.Fee);
        }

        internal static string ReadMemo(object data)
        {
            if (data is string text) return text;
            if (data is ByteString encoded) return (string)encoded;
            return "";
        }

        internal static bool IsLegacyTestnetOracle()
        {
            return Runtime.GetNetwork() == 894710606 && Oracle() == LegacyTestnetOracle;
        }
    }
}
