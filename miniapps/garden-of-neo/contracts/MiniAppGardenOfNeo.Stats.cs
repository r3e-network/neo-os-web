using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Stats Update Methods

        private static void UpdateUserStatsOnPlant(UInt160 user, BigInteger seedType)
        {
            UserStats stats = GetUserStats(user);
            stats.TotalPlanted += 1;
            stats.TotalSpent += PLANT_FEE;
            stats.FavoriteSeed = seedType;
            stats.LastPlantTime = Runtime.Time;
            StoreUserStats(user, stats);
        }

        private static void UpdateUserStatsOnHarvest(UInt160 user, BigInteger reward)
        {
            UserStats stats = GetUserStats(user);
            stats.TotalHarvested += 1;
            stats.TotalRewards += reward;
            StoreUserStats(user, stats);
        }

        private static BigInteger GetSeedReward(BigInteger seedType)
        {
            if (seedType == SEED_FIRE) return REWARD_FIRE;
            if (seedType == SEED_ICE) return REWARD_ICE;
            if (seedType == SEED_EARTH) return REWARD_EARTH;
            if (seedType == SEED_WIND) return REWARD_WIND;
            if (seedType == SEED_LIGHT) return REWARD_LIGHT;
            if (seedType == SEED_DARK) return REWARD_DARK;
            if (seedType == SEED_RARE) return REWARD_RARE;
            return REWARD_FIRE;
        }

        #endregion
    }
}
