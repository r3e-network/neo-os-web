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
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get all constants for frontend growth/reward calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCalculationConstants()
        {
            Map<string, object> constants = new Map<string, object>();

            // Growth constants
            constants["growthBlocks"] = GROWTH_BLOCKS;
            constants["waterGrowthBonus"] = WATER_GROWTH_BONUS;
            constants["fertilizeRewardBonus"] = FERTILIZE_REWARD_BONUS;
            constants["maxWaterPerDay"] = MAX_WATER_PER_DAY;

            // Fees
            constants["plantFee"] = PLANT_FEE;
            constants["waterFee"] = WATER_FEE;
            constants["fertilizeFee"] = FERTILIZE_FEE;
            constants["gardenFee"] = GARDEN_FEE;

            // Current blockchain state
            constants["currentBlock"] = Ledger.CurrentIndex;
            constants["currentTime"] = Runtime.Time;

            return constants;
        }

        /// <summary>
        /// Get seed rewards map for frontend.
        /// </summary>
        [Safe]
        public static Map<string, object> GetSeedRewardsMap()
        {
            Map<string, object> rewards = new Map<string, object>();
            rewards["fire"] = REWARD_FIRE;
            rewards["ice"] = REWARD_ICE;
            rewards["earth"] = REWARD_EARTH;
            rewards["wind"] = REWARD_WIND;
            rewards["light"] = REWARD_LIGHT;
            rewards["dark"] = REWARD_DARK;
            rewards["rare"] = REWARD_RARE;
            return rewards;
        }

        /// <summary>
        /// Calculate growth progress for a plant (for frontend display).
        /// </summary>
        [Safe]
        public static BigInteger CalculateGrowthProgress(
            BigInteger plantedBlock,
            BigInteger growthBonus)
        {
            BigInteger age = Ledger.CurrentIndex - plantedBlock;
            BigInteger effectiveGrowth = GROWTH_BLOCKS * 100 / (100 + growthBonus);
            if (effectiveGrowth <= 0) return 100;
            BigInteger progress = age * 100 / effectiveGrowth;
            return progress > 100 ? 100 : progress;
        }

        /// <summary>
        /// Calculate expected harvest reward (for frontend preview).
        /// </summary>
        [Safe]
        public static BigInteger CalculateExpectedReward(
            BigInteger seedType,
            BigInteger rewardBonus,
            bool hasSeasonBonus)
        {
            BigInteger baseReward = GetSeedReward(seedType);
            BigInteger bonusMultiplier = 100 + rewardBonus;
            if (hasSeasonBonus) bonusMultiplier += 25;
            return baseReward * bonusMultiplier / 100;
        }

        /// <summary>
        /// Get full plant state for frontend simulation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetPlantStateForFrontend(BigInteger plantId)
        {
            PlantData plant = GetPlant(plantId);
            Map<string, object> state = new Map<string, object>();

            if (plant.Owner == UInt160.Zero) return state;

            state["id"] = plantId;
            state["owner"] = plant.Owner;
            state["name"] = plant.Name;
            state["seedType"] = plant.SeedType;
            state["plantedBlock"] = plant.PlantedBlock;
            state["plantedTime"] = plant.PlantedTime;
            state["waterCount"] = plant.WaterCount;
            state["fertilizeCount"] = plant.FertilizeCount;
            state["growthBonus"] = plant.GrowthBonus;
            state["rewardBonus"] = plant.RewardBonus;
            state["harvested"] = plant.Harvested;

            // Current state
            state["currentBlock"] = Ledger.CurrentIndex;
            state["currentTime"] = Runtime.Time;

            if (!plant.Harvested)
            {
                // Growth calculation
                BigInteger progress = CalculateGrowthProgress(
                    plant.PlantedBlock, plant.GrowthBonus);
                state["growthProgress"] = progress;
                state["isMature"] = progress >= 100;

                // Reward preview
                SeasonData season = GetCurrentSeason();
                bool hasSeasonBonus = plant.SeedType == season.BonusSeedType;
                state["hasSeasonBonus"] = hasSeasonBonus;
                state["expectedReward"] = CalculateExpectedReward(
                    plant.SeedType, plant.RewardBonus, hasSeasonBonus);
            }

            return state;
        }

        #endregion
    }
}
