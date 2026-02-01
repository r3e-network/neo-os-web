using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        private static void UpdateUserStatsOnBury(UInt160 user, BigInteger category)
        {
            UpdateUserStatsOnBury(user, category, BURY_FEE);
        }

        private static void UpdateUserStatsOnBury(UInt160 user, BigInteger category, BigInteger spent)
        {
            UserStats stats = GetUserStats(user);

            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }

            stats.CapsulesBuried += 1;
            stats.TotalSpent += spent;
            stats.FavCategory = category;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnReveal(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.CapsulesRevealed += 1;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnFish(UInt160 user, BigInteger spent, BigInteger reward)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.CapsulesFished += 1;
            stats.TotalSpent += spent;
            if (reward > 0)
            {
                stats.TotalEarned += reward;
                stats.FishingRewards += reward;
            }
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnGift(UInt160 user, BigInteger spent)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.CapsulesGifted += 1;
            stats.TotalSpent += spent;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnReceive(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.CapsulesReceived += 1;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnExtend(UInt160 user, BigInteger spent)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.TotalSpent += spent;
            StoreUserStats(user, stats);
        }
    }
}
