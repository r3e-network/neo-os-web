using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Plant Methods

        /// <summary>
        /// Plant a new seed.
        /// </summary>
        public static BigInteger Plant(UInt160 owner, BigInteger seedType, string name, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(seedType >= SEED_FIRE && seedType <= SEED_RARE, "invalid seed");
            ExecutionEngine.Assert(name.Length <= MAX_NAME_LENGTH, "name too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, PLANT_FEE, receiptId);

            BigInteger plantId = TotalPlants() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PLANT_ID, plantId);

            PlantData plant = new PlantData
            {
                Owner = owner,
                Name = name.Length > 0 ? name : "Plant #" + plantId,
                SeedType = seedType,
                PlantedBlock = Ledger.CurrentIndex,
                PlantedTime = Runtime.Time,
                WaterCount = 0,
                FertilizeCount = 0,
                GrowthBonus = 0,
                RewardBonus = 0,
                Harvested = false,
                HarvestTime = 0,
                HarvestReward = 0
            };
            StorePlant(plantId, plant);

            AddUserPlant(owner, plantId);
            UpdateUserStatsOnPlant(owner, seedType);

            OnPlantSeeded(owner, plantId, seedType, plant.Name);
            return plantId;
        }

        #endregion
    }
}
