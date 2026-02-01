using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppOnChainTarot
    {
        #region Internal Helpers

        private static void StoreReading(BigInteger readingId, ReadingData reading)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READINGS, (ByteString)readingId.ToByteArray()),
                StdLib.Serialize(reading));
        }

        private static void StoreReader(UInt160 reader, ReaderProfile profile)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READERS, reader),
                StdLib.Serialize(profile));
        }

        private static BigInteger GetSpreadFee(BigInteger spreadType)
        {
            if (spreadType == SPREAD_SINGLE) return FEE_SINGLE;
            if (spreadType == SPREAD_THREE_CARD) return FEE_THREE_CARD;
            if (spreadType == SPREAD_FIVE_CARD) return FEE_FIVE_CARD;
            return FEE_CELTIC_CROSS;
        }

        private static BigInteger GetCardCount(BigInteger spreadType)
        {
            if (spreadType == SPREAD_SINGLE) return 1;
            if (spreadType == SPREAD_THREE_CARD) return 3;
            if (spreadType == SPREAD_FIVE_CARD) return 5;
            return 10; // Celtic Cross
        }

        private static void AddUserReading(UInt160 user, BigInteger readingId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_READING_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_READINGS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, readingId);
        }

        private static void UpdateUserStats(UInt160 user, BigInteger fee, BigInteger spreadType)
        {
            UserStats stats = GetUserStats(user);

            bool isNewUser = stats.JoinTime == 0;
            if (isNewUser)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }

            stats.TotalReadings += 1;
            stats.TotalSpent += fee;
            stats.LastReadingTime = Runtime.Time;
            stats.FavoriteSpread = spreadType;

            if (spreadType == SPREAD_CELTIC_CROSS)
            {
                stats.CelticCrossCount += 1;
            }

            StoreUserStats(user, stats);
            CheckUserBadges(user);
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        private static void UpdateSpreadCount(BigInteger spreadType)
        {
            byte[] key = Helper.Concat(PREFIX_SPREAD_COUNTS, (ByteString)spreadType.ToByteArray());
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, count + 1);
        }

        #endregion
    }
}
