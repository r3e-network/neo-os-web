using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Harvest Methods

        /// <summary>
        /// Harvest a mature plant.
        /// </summary>
        public static void Harvest(UInt160 owner, BigInteger plantId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PlantData plant = GetPlant(plantId);
            ExecutionEngine.Assert(plant.Owner == owner, "not owner");
            ExecutionEngine.Assert(!plant.Harvested, "already harvested");

            BigInteger age = Ledger.CurrentIndex - plant.PlantedBlock;
            BigInteger effectiveGrowth = GROWTH_BLOCKS * 100 / (100 + plant.GrowthBonus);
            ExecutionEngine.Assert(age >= effectiveGrowth, "not mature");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            BigInteger baseReward = GetSeedReward(plant.SeedType);
            BigInteger bonusMultiplier = 100 + plant.RewardBonus;

            SeasonData season = GetCurrentSeason();
            if (plant.SeedType == season.BonusSeedType)
            {
                bonusMultiplier += 25;
            }

            BigInteger reward = baseReward * bonusMultiplier / 100;

            plant.Harvested = true;
            plant.HarvestTime = Runtime.Time;
            plant.HarvestReward = reward;
            StorePlant(plantId, plant);

            UpdateUserStatsOnHarvest(owner, reward);

            BigInteger totalHarvested = TotalHarvested();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HARVESTED, totalHarvested + 1);

            BigInteger totalRewards = TotalRewardsDistributed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDS, totalRewards + reward);

            OnPlantHarvested(owner, plantId, reward);
        }

        #endregion
    }
}
