using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTarotVrf
    {
        /// <summary>
        /// Consume one prepaid reading fee and enqueue Morpheus randomness. maxOracleFee is
        /// a user-signed slippage cap; the external fee is paid from the separate reserve.
        /// </summary>
        public static BigInteger RequestReading(UInt160 player, BigInteger maxOracleFee)
        {
            ValidateAddress(player, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(!IsPaused(), "contract paused");
            ValidateConfiguredOracle();
            ExecutionEngine.Assert(maxOracleFee >= 0, "invalid oracle fee cap");
            ExecutionEngine.Assert(ActiveReadingInternal(player) == 0, "player already has a pending reading");
            ExecutionEngine.Assert(PendingCount() < MAX_PENDING, "too many pending readings");

            // Lock before the first dynamic Oracle call. Even read-only fee probes must not
            // create an unguarded window in which a signed admin/player can be reentered.
            AcquireLock();

            UInt160 oracle = Oracle();
            BigInteger oracleFee = ReadOracleRequestFee(oracle);
            ExecutionEngine.Assert(oracleFee >= 0, "invalid oracle fee");
            ExecutionEngine.Assert(oracleFee <= maxOracleFee, "oracle fee exceeds cap");
            ExecutionEngine.Assert(oracleFee <= READING_FEE, "oracle fee exceeds reading fee");

            BigInteger oracleCredit = ReadOracleFeeCredit(oracle);
            ExecutionEngine.Assert(oracleCredit >= 0, "invalid oracle fee credit");
            BigInteger shortfall = oracleFee > oracleCredit ? oracleFee - oracleCredit : 0;
            ExecutionEngine.Assert(OracleReserve() >= shortfall, "insufficient oracle reserve");
            ExecutionEngine.Assert(CreditOfInternal(player) >= READING_FEE, "insufficient reading credit");
            ExecutionEngine.Assert(
                TotalCreditLiability() >= READING_FEE,
                "credit liability invariant violated");

            BigInteger readingId = ReadingsCount() + 1;
            BigInteger now = Runtime.Time;
            BigInteger network = (BigInteger)Runtime.GetNetwork();
            string callbackMethod = IsLegacyTestnetOracle()
                ? LEGACY_CALLBACK_METHOD
                : RICH_CALLBACK_METHOD;
            ByteString payload = BuildRequestPayload(
                readingId,
                player,
                oracle,
                network,
                callbackMethod,
                now);
            ByteString payloadHash = CryptoLib.Sha256(payload);

            BigInteger nextCredit = CreditOfInternal(player) - READING_FEE;
            SetCredit(player, nextCredit);
            PutInteger(PREFIX_TOTAL_CREDIT, TotalCreditLiability() - READING_FEE);
            PutInteger(PREFIX_PENDING_FEES, PendingFees() + READING_FEE);
            PutInteger(PREFIX_PENDING_COUNT, PendingCount() + 1);
            PutInteger(PREFIX_READING_ID, readingId);
            Storage.Put(Storage.CurrentContext, AddressKey(PREFIX_ACTIVE_READING, player), readingId);

            Reading reading = new Reading
            {
                Player = player,
                Oracle = oracle,
                Network = network,
                RequestId = 0,
                Status = STATUS_PENDING,
                Card0 = -1,
                Card1 = -1,
                Card2 = -1,
                RequestedAt = now,
                ResolvedAt = 0,
                Fee = READING_FEE,
                OracleFee = oracleFee,
                CallbackMethod = callbackMethod,
                PayloadHash = payloadHash
            };
            StoreReading(readingId, reading);
            RecordPlayerReading(player, readingId);

            if (shortfall > 0)
            {
                PutInteger(PREFIX_ORACLE_RESERVE, OracleReserve() - shortfall);
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, oracle, shortfall,
                        (byte[])Runtime.ExecutingScriptHash),
                    "oracle fee funding failed");
            }

            BigInteger requestId = (BigInteger)Contract.Call(
                oracle,
                "requestFromCallback",
                CallFlags.All,
                player,
                REQUEST_TYPE,
                payload,
                Runtime.ExecutingScriptHash,
                callbackMethod);
            ExecutionEngine.Assert(requestId > 0, "oracle request failed");
            ExecutionEngine.Assert(ReadingForRequest(requestId) == 0, "duplicate oracle request id");
            ExecutionEngine.Assert(!RequestIdSeenInternal(requestId), "reused oracle request id");

            reading.RequestId = requestId;
            StoreReading(readingId, reading);
            Storage.Put(Storage.CurrentContext, IntegerKey(PREFIX_REQUEST_READING, requestId), readingId);
            Storage.Put(Storage.CurrentContext, IntegerKey(PREFIX_REQUEST_SEEN, requestId), 1);

            ReleaseLock();
            OnReadingRequested(
                readingId,
                requestId,
                player,
                READING_FEE,
                oracleFee,
                now + READING_EXPIRY_MS);
            return readingId;
        }

        internal static BigInteger ReadOracleRequestFee(UInt160 oracle)
        {
            return (BigInteger)Contract.Call(
                oracle,
                "requestFee",
                CallFlags.ReadOnly,
                new object[0]);
        }

        internal static BigInteger ReadOracleFeeCredit(UInt160 oracle)
        {
            return (BigInteger)Contract.Call(
                oracle,
                "feeCreditOf",
                CallFlags.ReadOnly,
                Runtime.ExecutingScriptHash);
        }
    }
}
