using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Stats Update Methods

        private static void UpdateUserSeasonData(UInt160 user, BigInteger seasonId, BigInteger amount, BigInteger points)
        {
            byte[] totalKey = Helper.Concat(PREFIX_USER_TOTAL_BURNS, user);
            BigInteger total = (BigInteger)Storage.Get(Storage.CurrentContext, totalKey);
            Storage.Put(Storage.CurrentContext, totalKey, total + amount);

            byte[] pointsKey = Helper.Concat(
                Helper.Concat(PREFIX_USER_POINTS, user),
                (ByteString)seasonId.ToByteArray());
            BigInteger currentPoints = (BigInteger)Storage.Get(Storage.CurrentContext, pointsKey);
            Storage.Put(Storage.CurrentContext, pointsKey, currentPoints + points);

            ByteString seasonPointsKey = Helper.Concat((ByteString)PREFIX_USER_POINTS, (ByteString)seasonId.ToByteArray());
            BigInteger seasonTotal = (BigInteger)Storage.Get(Storage.CurrentContext, seasonPointsKey);
            Storage.Put(Storage.CurrentContext, seasonPointsKey, seasonTotal + points);
        }

        private static void UpdateBurnerStats(UInt160 burner, BigInteger amount, BigInteger points, bool isNew, bool isTier3)
        {
            BurnerStats stats = GetBurnerStats(burner);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalBurners = TotalBurners();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNERS, totalBurners + 1);
            }

            stats.TotalBurned += amount;
            stats.TotalPoints += points;
            stats.BurnCount += 1;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestSingleBurn)
            {
                stats.HighestSingleBurn = amount;
            }

            if (isTier3)
            {
                stats.Tier3Burns += 1;
            }

            // Update streak info
            UserStreak streak = GetUserStreak(burner);
            stats.CurrentStreak = streak.CurrentStreak;
            if (streak.LongestStreak > stats.LongestStreak)
            {
                stats.LongestStreak = streak.LongestStreak;
            }

            StoreBurnerStats(burner, stats);
            CheckBurnerBadges(burner);
        }

        #endregion
    }
}
