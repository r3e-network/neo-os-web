using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates for tarot reading lifecycle
    public delegate void ReadingRequestedHandler(BigInteger readingId, UInt160 user, string question, BigInteger spreadType);
    public delegate void ReadingCompletedHandler(BigInteger readingId, UInt160 user, BigInteger[] cards);
    public delegate void ReadingRevealedHandler(BigInteger readingId, string interpretation);
    public delegate void InterpretationAddedHandler(BigInteger readingId, string interpretation, UInt160 interpreter);
    public delegate void ReadingRatedHandler(BigInteger readingId, UInt160 user, BigInteger rating);
    public delegate void ReaderRegisteredHandler(UInt160 reader, string name, BigInteger specialization);
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

    /// <summary>
    /// OnChainTarot MiniApp - Complete blockchain fortune telling platform.
    ///
    /// FEATURES:
    /// - Multiple spread types (3-card, Celtic Cross, etc.)
    /// - User reading history and statistics
    /// - Professional reader registration
    /// - Interpretation system with ratings
    /// - Card meaning database
    /// - Reading categories (love, career, general)
    ///
    /// MECHANICS:
    /// - TEE generates verifiable random card draws
    /// - Interpretations stored on-chain for transparency
    /// - Users can rate readings for quality tracking
    /// - Readers earn reputation through ratings
    /// </summary>
    [DisplayName("MiniAppOnChainTarot")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. OnChainTarot is a complete fortune telling platform with multiple spread types, user history, professional readers, and verifiable randomness.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppOnChainTarot : MiniAppComputeBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-onchaintarot";
        private const int TOTAL_CARDS = 78;
        private const int SPREAD_SINGLE = 1;
        private const int SPREAD_THREE_CARD = 2;
        private const int SPREAD_FIVE_CARD = 3;
        private const int SPREAD_CELTIC_CROSS = 4;
        private const long FEE_SINGLE = 5000000;          // 0.05 GAS
        private const long FEE_THREE_CARD = 10000000;     // 0.1 GAS
        private const long FEE_FIVE_CARD = 20000000;      // 0.2 GAS
        private const long FEE_CELTIC_CROSS = 50000000;   // 0.5 GAS
        private const int MAX_RATING = 5;
        private const int MAX_QUESTION_LENGTH = 500;
        private const int MAX_INTERPRETATION_LENGTH = 2000;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppServiceBase)
        private static readonly byte[] PREFIX_READING_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_READINGS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_READINGS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_READING_COUNT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_READERS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_READINGS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_INTERPRETATIONS = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_SPREAD_COUNTS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_TOTAL_READERS = new byte[] { 0x2C };
        #endregion

        #region Data Structures
        public struct ReadingData
        {
            public UInt160 User;
            public string Question;
            public BigInteger[] Cards;
            public BigInteger SpreadType;
            public BigInteger Category;
            public string Interpretation;
            public UInt160 Interpreter;
            public BigInteger Rating;
            public bool Completed;
            public bool Interpreted;
            public BigInteger Timestamp;
            public ByteString Seed;  // For hybrid mode verification
        }

        public struct UserStats
        {
            public BigInteger TotalReadings;
            public BigInteger TotalSpent;
            public BigInteger FavoriteSpread;
            public BigInteger LastReadingTime;
            public BigInteger AverageRating;
            public BigInteger JoinTime;
            public BigInteger BadgeCount;
            public BigInteger CelticCrossCount;
            public BigInteger RatingsGiven;
            public BigInteger HighestRating;
        }

        public struct ReaderProfile
        {
            public string Name;
            public BigInteger Specialization;
            public BigInteger TotalInterpretations;
            public BigInteger TotalRatings;
            public BigInteger RatingSum;
            public BigInteger RegisteredTime;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("ReadingRequested")]
        public static event ReadingRequestedHandler OnReadingRequested;

        [DisplayName("ReadingCompleted")]
        public static event ReadingCompletedHandler OnReadingCompleted;

        [DisplayName("ReadingRevealed")]
        public static event ReadingRevealedHandler OnReadingRevealed;

        [DisplayName("InterpretationAdded")]
        public static event InterpretationAddedHandler OnInterpretationAdded;

        [DisplayName("ReadingRated")]
        public static event ReadingRatedHandler OnReadingRated;

        [DisplayName("ReaderRegistered")]
        public static event ReaderRegisteredHandler OnReaderRegistered;

        [DisplayName("UserBadgeEarned")]
        public static event UserBadgeEarnedHandler OnUserBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READINGS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_INTERPRETATIONS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalReadings() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_READINGS);

        [Safe]
        public static BigInteger TotalInterpretations() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_INTERPRETATIONS);

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static BigInteger TotalReaders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_READERS);

        [Safe]
        public static BigInteger GetSpreadCount(BigInteger spreadType)
        {
            byte[] key = Helper.Concat(PREFIX_SPREAD_COUNTS, (ByteString)spreadType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static ReadingData GetReading(BigInteger readingId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READINGS, (ByteString)readingId.ToByteArray()));
            if (data == null) return new ReadingData();
            return (ReadingData)StdLib.Deserialize(data);
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static ReaderProfile GetReader(UInt160 reader)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READERS, reader));
            if (data == null) return new ReaderProfile();
            return (ReaderProfile)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserReadingCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_READING_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool HasUserBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}