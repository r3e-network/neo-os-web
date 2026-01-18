using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Stats Update Methods

        private static void UpdateUserStatsOnCreate(UInt160 user, BigInteger rating, bool isNew)
        {
            UserStats stats = GetUserStats(user);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalUsers = TotalUsers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, totalUsers + 1);
            }

            stats.RecordsCreated += 1;
            stats.TotalSpent += CREATE_FEE;
            stats.ReputationScore += 10;
            stats.LastActivityTime = Runtime.Time;

            if (rating > stats.HighestRating)
            {
                stats.HighestRating = rating;
            }

            StoreUserStats(user, stats);
            CheckAllBadges(user);
        }

        private static void UpdateUserStatsOnQuery(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.QueriesMade += 1;
            stats.TotalSpent += QUERY_FEE;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
            CheckAllBadges(user);
        }

        private static void UpdateUserStatsOnVerify(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.RecordsVerified += 1;
            stats.TotalSpent += VERIFY_FEE;
            stats.ReputationScore += 25;
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(user, stats);
            CheckAllBadges(user);
        }

        #endregion
    }
}
