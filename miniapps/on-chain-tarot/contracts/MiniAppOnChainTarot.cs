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
    /// <summary>
    /// OnChainTarot MiniApp - Decentralized tarot readings with professional interpreters.
    ///
    /// KEY FEATURES:
    /// - Multiple tarot spread types (Single, Three Card, Five Card, Celtic Cross)
    /// - RNG-based card drawing with verifiable randomness
    /// - Professional reader interpretation system
    /// - Reading ratings and reputation
    /// - Category-based readings (Love, Career, etc.)
    /// - Hybrid mode with TEE-verified computation
    ///
    /// SECURITY:
    /// - Verifiable random number generation
    /// - Reader verification and registration
    /// - Payment receipt validation
    /// - User authorization checks
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for reading fees
    /// </summary>
    [DisplayName("MiniAppOnChainTarot")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "OnChainTarot provides decentralized tarot readings with multiple spread types, professional interpretation, and verifiable randomness.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppOnChainTarot : MiniAppComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the OnChainTarot miniapp.</summary>
        private const string APP_ID = "miniapp-on-chain-tarot";
        
        /// <summary>Total cards in tarot deck (78).</summary>
        private const int TOTAL_CARDS = 78;
        
        /// <summary>Maximum question length (200 characters).</summary>
        private const int MAX_QUESTION_LENGTH = 200;
        
        /// <summary>Maximum interpretation length (1000 characters).</summary>
        private const int MAX_INTERPRETATION_LENGTH = 1000;
        
        /// <summary>Maximum rating value (5 stars).</summary>
        private const int MAX_RATING = 5;
        
        /// <summary>Single card spread type identifier.</summary>
        private const int SPREAD_SINGLE = 1;
        
        /// <summary>Three card spread type identifier.</summary>
        private const int SPREAD_THREE_CARD = 2;
        
        /// <summary>Five card spread type identifier.</summary>
        private const int SPREAD_FIVE_CARD = 3;
        
        /// <summary>Celtic Cross spread type identifier (10 cards).</summary>
        private const int SPREAD_CELTIC_CROSS = 4;
        
        /// <summary>Fee for single card spread (0.05 GAS).</summary>
        private const long FEE_SINGLE = 5000000;
        
        /// <summary>Fee for three card spread (0.1 GAS).</summary>
        private const long FEE_THREE_CARD = 10000000;
        
        /// <summary>Fee for five card spread (0.15 GAS).</summary>
        private const long FEE_FIVE_CARD = 15000000;
        
        /// <summary>Fee for Celtic Cross spread (0.25 GAS).</summary>
        private const long FEE_CELTIC_CROSS = 25000000;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppComputeBase)
        /// <summary>Prefix 0x40: Current reading ID counter.</summary>
        private static readonly byte[] PREFIX_READING_ID = new byte[] { 0x40 };
        
        /// <summary>Prefix 0x41: Reading data storage.</summary>
        private static readonly byte[] PREFIX_READINGS = new byte[] { 0x41 };
        
        /// <summary>Prefix 0x42: Reader profile storage.</summary>
        private static readonly byte[] PREFIX_READERS = new byte[] { 0x42 };
        
        /// <summary>Prefix 0x43: User statistics.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x43 };
        
        /// <summary>Prefix 0x44: User reading count.</summary>
        private static readonly byte[] PREFIX_USER_READING_COUNT = new byte[] { 0x44 };
        
        /// <summary>Prefix 0x45: User readings list.</summary>
        private static readonly byte[] PREFIX_USER_READINGS = new byte[] { 0x45 };
        
        /// <summary>Prefix 0x46: Spread type counts.</summary>
        private static readonly byte[] PREFIX_SPREAD_COUNTS = new byte[] { 0x46 };
        
        /// <summary>Prefix 0x47: Total readings counter.</summary>
        private static readonly byte[] PREFIX_TOTAL_READINGS = new byte[] { 0x47 };
        
        /// <summary>Prefix 0x48: Total interpretations.</summary>
        private static readonly byte[] PREFIX_TOTAL_INTERPRETATIONS = new byte[] { 0x48 };
        
        /// <summary>Prefix 0x49: Total readers.</summary>
        private static readonly byte[] PREFIX_TOTAL_READERS = new byte[] { 0x49 };
        
        /// <summary>Prefix 0x4A: Total users.</summary>
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x4A };
        
        /// <summary>Prefix 0x4B: Request to reading mapping.</summary>
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x4B };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a tarot reading session.
        /// FIELDS:
        /// - User: Reading requester address
        /// - Question: User's question
        /// - Cards: Array of drawn card indices
        /// - SpreadType: Type of spread (1-4)
        /// - Category: Reading category (1-5)
        /// - Interpretation: Reader's interpretation text
        /// - Interpreter: Reader address
        /// - Rating: User rating (1-5)
        /// - Completed: Whether cards have been drawn
        /// - Interpreted: Whether interpretation added
        /// - Timestamp: Creation time
        /// - Seed: Random seed for hybrid mode
        /// </summary>
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
            public ByteString Seed;
        }

        /// <summary>
        /// Professional reader profile.
        /// FIELDS:
        /// - Name: Reader display name
        /// - Specialization: 1=Love, 2=Career, 3=General
        /// - TotalInterpretations: Count of interpretations given
        /// - TotalRatings: Count of ratings received
        /// - RatingSum: Sum of all ratings
        /// - RegisteredTime: Registration timestamp
        /// - Active: Whether reader is currently active
        /// </summary>
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

        /// <summary>
        /// User statistics and preferences.
        /// FIELDS:
        /// - TotalReadings: Count of readings requested
        /// - TotalSpent: Total GAS spent on readings
        /// - FavoriteSpread: Most used spread type
        /// - RatingsGiven: Count of ratings submitted
        /// - HighestRating: Best rating given
        /// - CelticCrossCount: Count of Celtic Cross readings
        /// - JoinTime: First reading timestamp
        /// - LastReadingTime: Most recent reading timestamp
        /// </summary>
        public struct UserStats
        {
            public BigInteger TotalReadings;
            public BigInteger TotalSpent;
            public BigInteger FavoriteSpread;
            public BigInteger RatingsGiven;
            public BigInteger HighestRating;
            public BigInteger CelticCrossCount;
            public BigInteger JoinTime;
            public BigInteger LastReadingTime;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when reading is created.</summary>
        /// <param name="readingId">Unique reading identifier.</param>
        /// <param name="user">Requester address.</param>
        /// <param name="spreadType">Type of spread used.</param>
        /// <param name="cardCount">Number of cards drawn.</param>
        public delegate void ReadingCreatedHandler(BigInteger readingId, UInt160 user, BigInteger spreadType, BigInteger cardCount);
        
        /// <summary>Event emitted when reading is completed.</summary>
        /// <param name="readingId">Reading identifier.</param>
        /// <param name="cards">Array of drawn card indices.</param>
        public delegate void ReadingCompletedHandler(BigInteger readingId, BigInteger[] cards);
        
        /// <summary>Event emitted when interpretation is added.</summary>
        /// <param name="readingId">Reading identifier.</param>
        /// <param name="interpreter">Reader address.</param>
        public delegate void InterpretationAddedHandler(BigInteger readingId, UInt160 interpreter);
        
        /// <summary>Event emitted when reading is rated.</summary>
        /// <param name="readingId">Reading identifier.</param>
        /// <param name="rating">Rating given (1-5).</param>
        public delegate void ReadingRatedHandler(BigInteger readingId, BigInteger rating);
        
        /// <summary>Event emitted when reader is registered.</summary>
        /// <param name="reader">Reader address.</param>
        /// <param name="name">Reader name.</param>
        public delegate void ReaderRegisteredHandler(UInt160 reader, string name);
        
        /// <summary>Event emitted when user earns a badge.</summary>
        /// <param name="user">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("ReadingCreated")]
        public static event ReadingCreatedHandler OnReadingCreated;

        [DisplayName("ReadingCompleted")]
        public static event ReadingCompletedHandler OnReadingCompleted;

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
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READINGS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_INTERPRETATIONS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_READERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total readings count.
        /// </summary>
        /// <returns>Total readings.</returns>
        [Safe]
        public static BigInteger TotalReadings() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_READINGS);

        /// <summary>
        /// Gets total interpretations count.
        /// </summary>
        /// <returns>Total interpretations.</returns>
        [Safe]
        public static BigInteger TotalInterpretations() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_INTERPRETATIONS);

        /// <summary>
        /// Gets total registered readers.
        /// </summary>
        /// <returns>Total readers.</returns>
        [Safe]
        public static BigInteger TotalReaders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_READERS);

        /// <summary>
        /// Gets total unique users.
        /// </summary>
        /// <returns>Total users.</returns>
        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        /// <summary>
        /// Gets reading data by ID.
        /// </summary>
        /// <param name="readingId">Reading identifier.</param>
        /// <returns>Reading data struct.</returns>
        [Safe]
        public static ReadingData GetReading(BigInteger readingId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READINGS, (ByteString)readingId.ToByteArray()));
            if (data == null) return new ReadingData();
            return (ReadingData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets reader profile.
        /// </summary>
        /// <param name="reader">Reader address.</param>
        /// <returns>Reader profile struct.</returns>
        [Safe]
        public static ReaderProfile GetReader(UInt160 reader)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READERS, reader));
            if (data == null) return new ReaderProfile();
            return (ReaderProfile)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets user statistics.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>User stats struct.</returns>
        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets user's reading count.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Reading count.</returns>
        [Safe]
        public static BigInteger GetUserReadingCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_READING_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion
    }
}
