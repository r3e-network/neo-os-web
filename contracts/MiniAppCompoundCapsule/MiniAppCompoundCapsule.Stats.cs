using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region User Stats Updates

        private static void UpdateUserStatsOnCreate(UInt160 user, BigInteger amount, BigInteger lockDays, bool isNew)
        {
            UserStats stats = GetUserStatsData(user);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }

            stats.TotalCapsules += 1;
            stats.ActiveCapsules += 1;
            stats.TotalDeposited += amount;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestDeposit)
            {
                stats.HighestDeposit = amount;
            }
            if (lockDays > stats.LongestLock)
            {
                stats.LongestLock = lockDays;
            }

            StoreUserStats(user, stats);
            CheckUserBadges(user);
        }

        private static void UpdateUserStatsOnUnlock(UInt160 user, BigInteger principal, BigInteger earned)
        {
            UserStats stats = GetUserStatsData(user);

            stats.ActiveCapsules -= 1;
            stats.TotalWithdrawn += principal;
            stats.TotalEarned += earned;
            stats.LastActivityTime = Runtime.Time;

            StoreUserStats(user, stats);
            CheckUserBadges(user);

            // Update global withdrawn
            BigInteger totalWithdrawn = TotalWithdrawn();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_WITHDRAWN, totalWithdrawn + principal);
        }

        private static void UpdateUserStatsOnEarlyWithdraw(UInt160 user, BigInteger principal, BigInteger penalty)
        {
            UserStats stats = GetUserStatsData(user);

            stats.ActiveCapsules -= 1;
            stats.TotalWithdrawn += principal - penalty;
            stats.TotalPenalties += penalty;
            stats.LastActivityTime = Runtime.Time;

            StoreUserStats(user, stats);
        }

        #endregion
    }
}
