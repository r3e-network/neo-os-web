using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppOnChainTarot
    {
        #region User Methods

        /// <summary>
        /// [DEPRECATED] Uses service callback - use InitiateReading/SettleReading instead.
        /// InitiateReading generates seed, frontend calculates cards, SettleReading verifies.
        /// </summary>
        public static BigInteger RequestReading(UInt160 user, string question, BigInteger spreadType, BigInteger category, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(question.Length > 0 && question.Length <= MAX_QUESTION_LENGTH, "invalid question");
            ExecutionEngine.Assert(spreadType >= SPREAD_SINGLE && spreadType <= SPREAD_CELTIC_CROSS, "invalid spread");
            ExecutionEngine.Assert(category >= 1 && category <= 5, "invalid category");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

            BigInteger fee = GetSpreadFee(spreadType);
            ValidatePaymentReceipt(APP_ID, user, fee, receiptId);

            BigInteger readingId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_READING_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, readingId);

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
                Timestamp = Runtime.Time
            };
            StoreReading(readingId, reading);

            BigInteger cardCount = GetCardCount(spreadType);
            BigInteger requestId = RequestRng(readingId, cardCount);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()),
                readingId);

            AddUserReading(user, readingId);
            UpdateUserStats(user, fee, spreadType);

            UpdateSpreadCount(spreadType);
            BigInteger total = TotalReadings();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READINGS, total + 1);

            OnReadingRequested(readingId, user, question, spreadType);
            return readingId;
        }

        /// <summary>
        /// Add interpretation to a completed reading.
        /// </summary>
        public static void AddInterpretation(BigInteger readingId, string interpretation, UInt160 interpreter)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(interpretation.Length > 0 && interpretation.Length <= MAX_INTERPRETATION_LENGTH, "invalid interpretation");

            ReadingData reading = GetReading(readingId);
            ExecutionEngine.Assert(reading.User != UInt160.Zero, "reading not found");
            ExecutionEngine.Assert(reading.Completed, "reading not completed");
            ExecutionEngine.Assert(!reading.Interpreted, "already interpreted");

            ReaderProfile reader = GetReader(interpreter);
            bool isReader = reader.Active;
            bool isAdmin = Runtime.CheckWitness((UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN));
            ExecutionEngine.Assert(isReader || isAdmin, "not authorized interpreter");
            ExecutionEngine.Assert(Runtime.CheckWitness(interpreter), "unauthorized");

            reading.Interpretation = interpretation;
            reading.Interpreter = interpreter;
            reading.Interpreted = true;
            StoreReading(readingId, reading);

            if (isReader)
            {
                reader.TotalInterpretations += 1;
                StoreReader(interpreter, reader);
            }

            BigInteger totalInterp = TotalInterpretations();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_INTERPRETATIONS, totalInterp + 1);

            OnInterpretationAdded(readingId, interpretation, interpreter);
            OnReadingRevealed(readingId, interpretation);
        }

        /// <summary>
        /// Rate a reading (user only).
        /// </summary>
        public static void RateReading(BigInteger readingId, BigInteger rating)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(rating >= 1 && rating <= MAX_RATING, "rating 1-5");

            ReadingData reading = GetReading(readingId);
            ExecutionEngine.Assert(reading.User != UInt160.Zero, "reading not found");
            ExecutionEngine.Assert(reading.Interpreted, "not interpreted");
            ExecutionEngine.Assert(reading.Rating == 0, "already rated");
            ExecutionEngine.Assert(Runtime.CheckWitness(reading.User), "not owner");

            reading.Rating = rating;
            StoreReading(readingId, reading);

            UserStats userStats = GetUserStats(reading.User);
            userStats.RatingsGiven += 1;
            if (rating > userStats.HighestRating)
            {
                userStats.HighestRating = rating;
            }
            StoreUserStats(reading.User, userStats);
            CheckUserBadges(reading.User);

            if (reading.Interpreter != UInt160.Zero)
            {
                ReaderProfile reader = GetReader(reading.Interpreter);
                if (reader.Active)
                {
                    reader.TotalRatings += 1;
                    reader.RatingSum += rating;
                    StoreReader(reading.Interpreter, reader);
                }
            }

            OnReadingRated(readingId, reading.User, rating);
        }

        #endregion

        #region Admin Methods

        /// <summary>
        /// Register a professional reader.
        /// </summary>
        public static void RegisterReader(UInt160 reader, string name, BigInteger specialization)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(reader.IsValid, "invalid address");
            ExecutionEngine.Assert(name.Length > 0 && name.Length <= 100, "invalid name");
            ExecutionEngine.Assert(specialization >= 1 && specialization <= 3, "invalid specialization");

            ReaderProfile existing = GetReader(reader);
            bool isNewReader = existing.RegisteredTime == 0;

            ReaderProfile profile = new ReaderProfile
            {
                Name = name,
                Specialization = specialization,
                TotalInterpretations = existing.TotalInterpretations,
                TotalRatings = existing.TotalRatings,
                RatingSum = existing.RatingSum,
                RegisteredTime = isNewReader ? Runtime.Time : existing.RegisteredTime,
                Active = true
            };
            StoreReader(reader, profile);

            if (isNewReader)
            {
                BigInteger totalReaders = TotalReaders();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READERS, totalReaders + 1);
            }

            OnReaderRegistered(reader, name, specialization);
        }

        /// <summary>
        /// Deactivate a reader.
        /// </summary>
        public static void DeactivateReader(UInt160 reader)
        {
            ValidateAdmin();
            ReaderProfile profile = GetReader(reader);
            ExecutionEngine.Assert(profile.Active, "not active");
            profile.Active = false;
            StoreReader(reader, profile);
        }

        #endregion

        #region Service Callbacks

        private static BigInteger RequestRng(BigInteger readingId, BigInteger cardCount)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { readingId, cardCount });
            return (BigInteger)Contract.Call(gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload, Runtime.ExecutingScriptHash, "onServiceCallback");
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString readingIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
            if (readingIdData == null) return;

            BigInteger readingId = (BigInteger)readingIdData;
            ReadingData reading = GetReading(readingId);

            if (success && result != null)
            {
                object[] rngResult = (object[])StdLib.Deserialize(result);
                BigInteger cardCount = GetCardCount(reading.SpreadType);
                BigInteger[] cards = new BigInteger[(int)cardCount];

                for (int i = 0; i < (int)cardCount; i++)
                {
                    cards[i] = (BigInteger)rngResult[i] % TOTAL_CARDS;
                }
                reading.Cards = cards;
                reading.Completed = true;
                StoreReading(readingId, reading);
                OnReadingCompleted(readingId, reading.User, cards);
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }

        #endregion
    }
}