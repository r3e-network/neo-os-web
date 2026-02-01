using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetPlantStatus(BigInteger plantId)
        {
            PlantData plant = GetPlant(plantId);
            Map<string, object> status = new Map<string, object>();

            if (plant.Owner == UInt160.Zero) return status;

            BigInteger currentBlock = Ledger.CurrentIndex;
            BigInteger age = currentBlock - plant.PlantedBlock;
            BigInteger effectiveGrowth = GROWTH_BLOCKS * 100 / (100 + plant.GrowthBonus);

            BigInteger growthPercent = age * 100 / effectiveGrowth;
            if (growthPercent > 100) growthPercent = 100;

            status["plantId"] = plantId;
            status["growthPercent"] = growthPercent;
            status["isMature"] = age >= effectiveGrowth;
            status["blocksRemaining"] = age >= effectiveGrowth ? 0 : effectiveGrowth - age;
            status["waterCount"] = plant.WaterCount;
            status["fertilizeCount"] = plant.FertilizeCount;

            return status;
        }

        [Safe]
        public static Map<string, object> GetPlantDetails(BigInteger plantId)
        {
            PlantData plant = GetPlant(plantId);
            Map<string, object> details = new Map<string, object>();
            if (plant.Owner == UInt160.Zero) return details;

            details["id"] = plantId;
            details["owner"] = plant.Owner;
            details["name"] = plant.Name;
            details["seedType"] = plant.SeedType;
            details["plantedBlock"] = plant.PlantedBlock;
            details["plantedTime"] = plant.PlantedTime;
            details["waterCount"] = plant.WaterCount;
            details["fertilizeCount"] = plant.FertilizeCount;
            details["growthBonus"] = plant.GrowthBonus;
            details["rewardBonus"] = plant.RewardBonus;
            details["harvested"] = plant.Harvested;

            if (plant.Harvested)
            {
                details["harvestTime"] = plant.HarvestTime;
                details["harvestReward"] = plant.HarvestReward;
            }
            else
            {
                BigInteger age = Ledger.CurrentIndex - plant.PlantedBlock;
                BigInteger effectiveGrowth = GROWTH_BLOCKS * 100 / (100 + plant.GrowthBonus);
                BigInteger growthPercent = age * 100 / effectiveGrowth;
                if (growthPercent > 100) growthPercent = 100;
                details["growthPercent"] = growthPercent;
                details["isMature"] = age >= effectiveGrowth;
            }

            return details;
        }

        #endregion
    }
}
