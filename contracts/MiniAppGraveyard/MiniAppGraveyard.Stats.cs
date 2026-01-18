using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGraveyard
    {
        #region Stats Update Methods

        private static void UpdateUserStatsOnBury(UInt160 user, BigInteger memoryType, BigInteger spent, bool isNew)
        {
            UserStats stats = GetUserStatsData(user);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }

            stats.MemoriesBuried += 1;
            stats.TotalSpent += spent;
            stats.LastActivityTime = Runtime.Time;

            // Track by type
            if (memoryType == 1) stats.SecretsBuried += 1;
            else if (memoryType == 2) stats.RegretsBuried += 1;
            else if (memoryType == 3) stats.WishesBuried += 1;

            StoreUserStats(user, stats);
            CheckUserBadges(user);
        }

        private static void UpdateUserStatsOnForget(UInt160 user, BigInteger spent)
        {
            UserStats stats = GetUserStatsData(user);
            stats.MemoriesForgotten += 1;
            stats.TotalSpent += spent;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
            CheckUserBadges(user);
        }

        private static void UpdateUserStatsOnMemorial(UInt160 user, BigInteger spent, bool isNew)
        {
            UserStats stats = GetUserStatsData(user);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }

            stats.MemorialsCreated += 1;
            stats.TotalSpent += spent;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
            CheckUserBadges(user);
        }

        private static void UpdateUserStatsOnTribute(UInt160 sender, BigInteger amount)
        {
            UserStats stats = GetUserStatsData(sender);
            stats.TributesSent += amount;
            stats.TotalSpent += amount;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(sender, stats);
            CheckUserBadges(sender);
        }

        private static void UpdateCreatorTributesReceived(UInt160 creator, BigInteger amount)
        {
            UserStats stats = GetUserStatsData(creator);
            stats.TributesReceived += amount;
            StoreUserStats(creator, stats);
        }

        #endregion
    }
}
