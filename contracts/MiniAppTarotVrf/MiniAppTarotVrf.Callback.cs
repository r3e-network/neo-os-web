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
        /// Legacy five-argument adapter. It is deliberately enabled only for the canonical
        /// Morpheus testnet deployment whose live ABI still exposes this callback generation.
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId,
            string requestType,
            bool success,
            ByteString result,
            string error)
        {
            ExecutionEngine.Assert(IsLegacyTestnetOracle(), "legacy callback disabled");
            ValidateOracleCaller();
            ExecutionEngine.Assert(requestType == REQUEST_TYPE, "unexpected oracle request type");
            ResolveCallback(requestId, success, result, LEGACY_CALLBACK_METHOD);
        }

        /// <summary>Canonical MiniApp OS rich callback adapter.</summary>
        public static void OnMiniAppResult(
            BigInteger requestId,
            string appId,
            string moduleId,
            string operation,
            UInt160 requester,
            bool success,
            ByteString result,
            string error)
        {
            ValidateOracleCaller();
            ExecutionEngine.Assert(appId == APP_ID, "unexpected app id");
            ExecutionEngine.Assert(moduleId == REQUEST_TYPE, "unexpected oracle module");
            ExecutionEngine.Assert(operation == REQUEST_TYPE, "unexpected oracle operation");

            BigInteger readingId = ReadingForRequest(requestId);
            ExecutionEngine.Assert(readingId > 0, "unknown oracle request");
            Reading reading = LoadReading(readingId);
            ExecutionEngine.Assert(requester == reading.Player, "requester mismatch");
            ResolveCallback(requestId, success, result, RICH_CALLBACK_METHOD);
        }

        /// <summary>
        /// Permissionless timeout recovery. It always refunds the stored player and can settle
        /// each reading once; callers cannot redirect funds.
        /// </summary>
        public static BigInteger RefundExpiredReading(BigInteger readingId)
        {
            Reading reading = LoadReading(readingId);
            ExecutionEngine.Assert(reading.Player != UInt160.Zero, "reading not found");
            ExecutionEngine.Assert(reading.Status == STATUS_PENDING, "reading not pending");
            ExecutionEngine.Assert(reading.RequestId > 0, "request not bound");
            ValidateStoredPendingBinding(readingId, reading.RequestId, reading);
            ExecutionEngine.Assert(
                Runtime.Time >= reading.RequestedAt + READING_EXPIRY_MS,
                "reading not expired");

            AcquireLock();
            RefundPending(
                readingId,
                reading.RequestId,
                reading,
                STATUS_EXPIRED_REFUNDED,
                "oracle timeout");
            ReleaseLock();
            return reading.Fee;
        }

        /// <summary>Explicit cancellation name for clients; cancellation obeys the same TTL.</summary>
        public static BigInteger CancelExpiredReading(BigInteger readingId) =>
            RefundExpiredReading(readingId);

        internal static void ValidateOracleCaller()
        {
            ValidateConfiguredOracle();
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Oracle(), "oracle only");
        }

        internal static void ResolveCallback(
            BigInteger requestId,
            bool success,
            ByteString result,
            string callbackMethod)
        {
            BigInteger readingId = ReadingForRequest(requestId);
            ExecutionEngine.Assert(readingId > 0, "unknown oracle request");
            Reading reading = LoadReading(readingId);
            ValidatePendingBinding(readingId, requestId, reading, callbackMethod);

            AcquireLock();
            if (Runtime.Time >= reading.RequestedAt + READING_EXPIRY_MS)
            {
                RefundPending(
                    readingId,
                    requestId,
                    reading,
                    STATUS_EXPIRED_REFUNDED,
                    "oracle timeout");
                ReleaseLock();
                return;
            }

            if (!success || result == null || result.Length != 32)
            {
                RefundPending(
                    readingId,
                    requestId,
                    reading,
                    STATUS_ORACLE_REFUNDED,
                    "oracle failure");
                ReleaseLock();
                return;
            }

            BigInteger[] cards = SampleBoundCards(result, reading.PayloadHash);
            if (cards.Length != CARDS_PER_READING)
            {
                RefundPending(
                    readingId,
                    requestId,
                    reading,
                    STATUS_ORACLE_REFUNDED,
                    "oracle entropy rejected");
                ReleaseLock();
                return;
            }

            ClosePending(readingId, requestId, reading);
            reading.Status = STATUS_DRAWN;
            reading.Card0 = cards[0];
            reading.Card1 = cards[1];
            reading.Card2 = cards[2];
            reading.ResolvedAt = Runtime.Time;
            StoreReading(readingId, reading);

            PutInteger(PREFIX_COMPLETED_COUNT, CompletedReadingsCount() + 1);
            Storage.Put(
                Storage.CurrentContext,
                AddressKey(PREFIX_PLAYER_COMPLETED_COUNT, reading.Player),
                PlayerCompletedReadingCount(reading.Player) + 1);

            PutInteger(PREFIX_ORACLE_RESERVE, OracleReserve() + reading.OracleFee);
            PutInteger(PREFIX_REVENUE, Revenue() + reading.Fee - reading.OracleFee);

            ReleaseLock();
            OnReadingDrawn(
                readingId,
                requestId,
                reading.Player,
                cards[0],
                cards[1],
                cards[2]);
        }

        internal static void RefundPending(
            BigInteger readingId,
            BigInteger requestId,
            Reading reading,
            BigInteger terminalStatus,
            string reason)
        {
            ClosePending(readingId, requestId, reading);
            reading.Status = terminalStatus;
            reading.ResolvedAt = Runtime.Time;
            StoreReading(readingId, reading);

            BigInteger balance = CreditOfInternal(reading.Player) + reading.Fee;
            SetCredit(reading.Player, balance);
            PutInteger(PREFIX_TOTAL_CREDIT, TotalCreditLiability() + reading.Fee);
            OnReadingRefunded(
                readingId,
                requestId,
                reading.Player,
                reading.Fee,
                terminalStatus,
                reason);
        }

        /// <summary>
        /// Hashes the signed raw result with the request payload commitment, then draws from a
        /// partial Fisher-Yates deck using 16-bit rejection sampling. No modulo fallback exists.
        /// </summary>
        internal static BigInteger[] SampleBoundCards(ByteString result, ByteString payloadHash)
        {
            byte[] boundInput = (byte[])Helper.Concat(result, payloadHash);
            byte[] entropy = (byte[])CryptoLib.Sha256((ByteString)boundInput);
            BigInteger[] deck = new BigInteger[DECK_SIZE];
            for (int index = 0; index < DECK_SIZE; index++) deck[index] = index;

            int drawn = 0;
            int cursor = 0;
            while (drawn < CARDS_PER_READING && cursor + 1 < entropy.Length)
            {
                int candidate = entropy[cursor] * 256 + entropy[cursor + 1];
                cursor += 2;
                int remaining = DECK_SIZE - drawn;
                int acceptanceLimit = 65536 - (65536 % remaining);
                if (candidate >= acceptanceLimit) continue;

                int swapWith = drawn + candidate % remaining;
                BigInteger selected = deck[swapWith];
                deck[swapWith] = deck[drawn];
                deck[drawn] = selected;
                drawn += 1;
            }

            if (drawn != CARDS_PER_READING) return new BigInteger[0];
            return new BigInteger[] { deck[0], deck[1], deck[2] };
        }
    }
}
