using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppOnChainTarot
    {
        #region Hybrid Mode - Two-Phase Reading with Script Verification

        // Script name for card calculation (registered via MiniAppComputeBase)
        private const string SCRIPT_CALCULATE_CARDS = "calculate-cards";

        // Storage prefix for reading operation data
        private static readonly byte[] PREFIX_READING_OPERATION = new byte[] { 0x50 };

        /// <summary>
        /// Get tarot constants for frontend calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetTarotConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["totalCards"] = TOTAL_CARDS;
            constants["currentTime"] = Runtime.Time;
            constants["scriptName"] = SCRIPT_CALCULATE_CARDS;
            constants["scriptHash"] = GetScriptHash(SCRIPT_CALCULATE_CARDS);
            constants["scriptVersion"] = GetScriptVersion(SCRIPT_CALCULATE_CARDS);
            return constants;
        }

        /// <summary>
        /// Phase 1: Initiate reading - generates seed for off-chain card calculation.
        /// Uses MiniAppComputeBase for script registration and seed generation.
        /// Flow: InitiateReading → Edge compute (TEE) → SettleReading
        /// </summary>
        public static object[] InitiateReading(
            UInt160 user,
            string question,
            BigInteger spreadType,
            BigInteger category,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(question.Length > 0 && question.Length <= MAX_QUESTION_LENGTH, "invalid question");
            ExecutionEngine.Assert(spreadType >= SPREAD_SINGLE && spreadType <= SPREAD_CELTIC_CROSS, "invalid spread");
            ExecutionEngine.Assert(category >= 1 && category <= 5, "invalid category");

            // Verify script is registered
            ExecutionEngine.Assert(IsScriptEnabled(SCRIPT_CALCULATE_CARDS), "script not registered");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

            BigInteger fee = GetSpreadFee(spreadType);
            ValidatePaymentReceipt(APP_ID, user, fee, receiptId);

            BigInteger readingId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_READING_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, readingId);

            // Generate deterministic seed using MiniAppComputeBase
            ByteString seed = GenerateOperationSeed(readingId, user, SCRIPT_CALCULATE_CARDS);

            // Store operation data for settlement
            ByteString operationData = StdLib.Serialize(new object[] {
                user, question, spreadType, category, fee
            });
            StoreReadingOperation(readingId, operationData);

            ReadingData reading = new ReadingData
            {
                User = user,
                Question = question,
                Cards = new BigInteger[0],
                SpreadType = spreadType,
                Category = category,
                Interpretation = "",
                Interpreter = UInt160.Zero,
                Rating = 0,
                Completed = false,
                Interpreted = false,
                Timestamp = Runtime.Time,
                Seed = seed
            };
            StoreReading(readingId, reading);

            AddUserReading(user, readingId);
            UpdateUserStats(user, fee, spreadType);
            UpdateSpreadCount(spreadType);

            BigInteger total = TotalReadings();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READINGS, total + 1);

            BigInteger cardCount = GetCardCount(spreadType);

            // Emit event with script info for Edge verification
            return new object[] { readingId, seed, cardCount, SCRIPT_CALCULATE_CARDS };
        }

        /// <summary>
        /// Phase 2: Settle reading with TEE-calculated cards.
        /// Verifies script hash matches registered script.
        /// </summary>
        public static bool SettleReading(
            UInt160 user,
            BigInteger readingId,
            BigInteger[] calculatedCards,
            ByteString scriptHash)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

            ReadingData reading = GetReading(readingId);
            ExecutionEngine.Assert(reading.User != UInt160.Zero, "reading not found");
            ExecutionEngine.Assert(reading.User == user, "not owner");
            ExecutionEngine.Assert(!reading.Completed, "already completed");

            // Verify script hash using MiniAppComputeBase
            ValidateScriptHash(SCRIPT_CALCULATE_CARDS, scriptHash);

            // Get stored seed and verify it exists
            ByteString storedSeed = GetOperationSeed(readingId);
            ExecutionEngine.Assert(storedSeed != null, "seed not found");

            // Verify card count
            BigInteger expectedCardCount = GetCardCount(reading.SpreadType);
            ExecutionEngine.Assert(calculatedCards.Length == (int)expectedCardCount, "wrong card count");

            // Verify cards are valid and match seed
            BigInteger[] expectedCards = CalculateCardsFromSeed(storedSeed, expectedCardCount);
            for (int i = 0; i < calculatedCards.Length; i++)
            {
                ExecutionEngine.Assert(calculatedCards[i] == expectedCards[i], "card mismatch");
            }

            // Update reading
            reading.Cards = calculatedCards;
            reading.Completed = true;
            StoreReading(readingId, reading);

            // Clean up operation data
            DeleteReadingOperation(readingId);
            DeleteOperationSeed(readingId);

            return true;
        }

        /// <summary>
        /// Calculate cards from seed (exposed for frontend verification).
        /// This is a reference implementation - TEE script uses the same algorithm.
        /// </summary>
        [Safe]
        public static BigInteger[] CalculateCardsFromSeed(ByteString seed, BigInteger cardCount)
        {
            BigInteger[] cards = new BigInteger[(int)cardCount];
            ByteString currentHash = seed;

            for (int i = 0; i < (int)cardCount; i++)
            {
                ByteString toHash = Helper.Concat(currentHash, (ByteString)((BigInteger)i).ToByteArray());
                currentHash = CryptoLib.Sha256(toHash);
                byte[] hashBytes = (byte[])currentHash;

                BigInteger cardValue = 0;
                for (int j = 0; j < 4; j++)
                {
                    cardValue = cardValue * 256 + hashBytes[j];
                }
                cards[i] = cardValue % TOTAL_CARDS;
            }

            return cards;
        }

        #region Operation Storage Helpers

        private static void StoreReadingOperation(BigInteger readingId, ByteString data)
        {
            byte[] key = Helper.Concat(PREFIX_READING_OPERATION, readingId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, data);
        }

        [Safe]
        public static ByteString GetReadingOperation(BigInteger readingId)
        {
            byte[] key = Helper.Concat(PREFIX_READING_OPERATION, readingId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key);
        }

        private static void DeleteReadingOperation(BigInteger readingId)
        {
            byte[] key = Helper.Concat(PREFIX_READING_OPERATION, readingId.ToByteArray());
            Storage.Delete(Storage.CurrentContext, key);
        }

        #endregion

        // Event for hybrid mode
        public delegate void ReadingInitiatedHandler(
            UInt160 user, BigInteger readingId, BigInteger spreadType,
            BigInteger cardCount, ByteString seed);

        [System.ComponentModel.DisplayName("ReadingInitiated")]
        public static event ReadingInitiatedHandler OnReadingInitiated;

        #endregion

        #region Query Methods - Frontend Calculation Support

        /// <summary>
        /// Get raw reading data without calculations.
        /// Frontend calculates: averageRating
        /// </summary>
        [Safe]
        public static Map<string, object> GetReadingRaw(BigInteger readingId)
        {
            ReadingData reading = GetReading(readingId);
            Map<string, object> data = new Map<string, object>();
            if (reading.User == UInt160.Zero) return data;

            data["id"] = readingId;
            data["user"] = reading.User;
            data["spreadType"] = reading.SpreadType;
            data["cards"] = reading.Cards;
            data["timestamp"] = reading.Timestamp;
            data["seed"] = reading.Seed;

            return data;
        }

        /// <summary>
        /// Get raw reader profile without calculations.
        /// Frontend calculates: averageRating = ratingSum * 100 / totalRatings
        /// </summary>
        [Safe]
        public static Map<string, object> GetReaderProfileRaw(UInt160 reader)
        {
            ReaderProfile profile = GetReader(reader);
            Map<string, object> data = new Map<string, object>();

            data["totalInterpretations"] = profile.TotalInterpretations;
            data["totalRatings"] = profile.TotalRatings;
            data["ratingSum"] = profile.RatingSum;
            data["registeredTime"] = profile.RegisteredTime;

            return data;
        }

        #endregion
    }
}
