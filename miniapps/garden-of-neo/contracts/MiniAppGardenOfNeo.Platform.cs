using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetGardenDetails(BigInteger gardenId)
        {
            GardenData garden = GetGarden(gardenId);
            Map<string, object> details = new Map<string, object>();
            if (garden.Owner == UInt160.Zero) return details;

            details["id"] = gardenId;
            details["owner"] = garden.Owner;
            details["name"] = garden.Name;
            details["createdTime"] = garden.CreatedTime;
            details["plantCount"] = garden.PlantCount;
            details["totalHarvested"] = garden.TotalHarvested;
            details["totalRewards"] = garden.TotalRewards;
            details["active"] = garden.Active;

            return details;
        }

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["totalPlanted"] = stats.TotalPlanted;
            details["totalHarvested"] = stats.TotalHarvested;
            details["totalRewards"] = stats.TotalRewards;
            details["totalSpent"] = stats.TotalSpent;
            details["favoriteSeed"] = stats.FavoriteSeed;
            details["gardenCount"] = stats.GardenCount;
            details["lastPlantTime"] = stats.LastPlantTime;
            details["currentStreak"] = stats.CurrentStreak;
            details["plantCount"] = GetUserPlantCount(user);

            return details;
        }

        [Safe]
        public static Map<string, object> GetSeasonDetails()
        {
            SeasonData season = GetCurrentSeason();
            Map<string, object> details = new Map<string, object>();

            details["id"] = season.Id;
            details["seasonType"] = season.SeasonType;
            details["startTime"] = season.StartTime;
            details["endTime"] = season.EndTime;
            details["bonusSeedType"] = season.BonusSeedType;

            if (season.EndTime > 0)
            {
                BigInteger remaining = season.EndTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalPlants"] = TotalPlants();
            stats["totalGardens"] = TotalGardens();
            stats["totalHarvested"] = TotalHarvested();
            stats["totalRewardsDistributed"] = TotalRewardsDistributed();

            SeasonData season = GetCurrentSeason();
            stats["currentSeason"] = season.Id;
            stats["currentSeasonType"] = season.SeasonType;

            return stats;
        }

        #endregion
    }
}
