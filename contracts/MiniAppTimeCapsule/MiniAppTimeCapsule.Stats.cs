using System.Numerics;
using Neo;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region User Stats Updates

        private static void UpdateUserStatsOnBury(UInt160 user, BigInteger category)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0) stats.JoinTime = Runtime.Time;
            stats.CapsulesBuried += 1;
            stats.TotalSpent += BURY_FEE;
            stats.FavCategory = category;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnReveal(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.CapsulesRevealed += 1;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnFish(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0) stats.JoinTime = Runtime.Time;
            stats.CapsulesFished += 1;
            stats.TotalSpent += FISH_FEE;
            stats.FishingRewards += FISH_REWARD;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnGift(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            stats.CapsulesGifted += 1;
            stats.TotalSpent += GIFT_FEE;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnReceive(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            if (stats.JoinTime == 0) stats.JoinTime = Runtime.Time;
            stats.CapsulesReceived += 1;
            StoreUserStats(user, stats);
        }

        #endregion
    }
}
