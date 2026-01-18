using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppOnChainTarot
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetReadingDetails(BigInteger readingId)
        {
            ReadingData reading = GetReading(readingId);
            Map<string, object> details = new Map<string, object>();
            if (reading.User == UInt160.Zero) return details;

            details["id"] = readingId;
            details["user"] = reading.User;
            details["question"] = reading.Question;
            details["spreadType"] = reading.SpreadType;
            details["category"] = reading.Category;
            details["completed"] = reading.Completed;
            details["interpreted"] = reading.Interpreted;
            details["timestamp"] = reading.Timestamp;

            if (reading.Completed)
            {
                details["cards"] = reading.Cards;
            }
            if (reading.Interpreted)
            {
                details["interpretation"] = reading.Interpretation;
                details["interpreter"] = reading.Interpreter;
                details["rating"] = reading.Rating;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["totalReadings"] = stats.TotalReadings;
            details["totalSpent"] = stats.TotalSpent;
            details["favoriteSpread"] = stats.FavoriteSpread;
            details["lastReadingTime"] = stats.LastReadingTime;
            details["readingCount"] = GetUserReadingCount(user);
            details["joinTime"] = stats.JoinTime;
            details["badgeCount"] = stats.BadgeCount;
            details["celticCrossCount"] = stats.CelticCrossCount;
            details["ratingsGiven"] = stats.RatingsGiven;
            details["highestRating"] = stats.HighestRating;

            details["hasFirstReading"] = HasUserBadge(user, 1);
            details["hasSeeker"] = HasUserBadge(user, 2);
            details["hasMystic"] = HasUserBadge(user, 3);
            details["hasCelticMaster"] = HasUserBadge(user, 4);
            details["hasBigSpender"] = HasUserBadge(user, 5);
            details["hasRater"] = HasUserBadge(user, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetReaderDetails(UInt160 reader)
        {
            ReaderProfile profile = GetReader(reader);
            Map<string, object> details = new Map<string, object>();
            if (!profile.Active && profile.RegisteredTime == 0) return details;

            details["name"] = profile.Name;
            details["specialization"] = profile.Specialization;
            details["totalInterpretations"] = profile.TotalInterpretations;
            details["totalRatings"] = profile.TotalRatings;
            details["registeredTime"] = profile.RegisteredTime;
            details["active"] = profile.Active;

            if (profile.TotalRatings > 0)
            {
                details["averageRating"] = profile.RatingSum * 100 / profile.TotalRatings;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalReadings"] = TotalReadings();
            stats["totalInterpretations"] = TotalInterpretations();
            stats["totalUsers"] = TotalUsers();
            stats["totalReaders"] = TotalReaders();
            stats["singleCardReadings"] = GetSpreadCount(SPREAD_SINGLE);
            stats["threeCardReadings"] = GetSpreadCount(SPREAD_THREE_CARD);
            stats["fiveCardReadings"] = GetSpreadCount(SPREAD_FIVE_CARD);
            stats["celticCrossReadings"] = GetSpreadCount(SPREAD_CELTIC_CROSS);

            stats["feeSingle"] = FEE_SINGLE;
            stats["feeThreeCard"] = FEE_THREE_CARD;
            stats["feeFiveCard"] = FEE_FIVE_CARD;
            stats["feeCelticCross"] = FEE_CELTIC_CROSS;
            stats["totalCards"] = TOTAL_CARDS;
            stats["maxRating"] = MAX_RATING;
            stats["maxQuestionLength"] = MAX_QUESTION_LENGTH;
            stats["maxInterpretationLength"] = MAX_INTERPRETATION_LENGTH;

            return stats;
        }

        [Safe]
        public static BigInteger[] GetUserReadings(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserReadingCount(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_READINGS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        #endregion
    }
}