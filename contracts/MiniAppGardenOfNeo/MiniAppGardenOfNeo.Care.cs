using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Plant Care Methods

        /// <summary>
        /// Water a plant to speed up growth.
        /// </summary>
        public static void WaterPlant(UInt160 waterer, BigInteger plantId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PlantData plant = GetPlant(plantId);
            ExecutionEngine.Assert(plant.Owner != UInt160.Zero, "plant not found");
            ExecutionEngine.Assert(!plant.Harvested, "already harvested");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(waterer), "unauthorized");

            ValidatePaymentReceipt(APP_ID, waterer, WATER_FEE, receiptId);

            plant.WaterCount += 1;
            plant.GrowthBonus += WATER_GROWTH_BONUS;
            StorePlant(plantId, plant);

            OnPlantWatered(plantId, waterer, WATER_GROWTH_BONUS);
        }

        /// <summary>
        /// Fertilize a plant to increase rewards.
        /// </summary>
        public static void FertilizePlant(UInt160 fertilizer, BigInteger plantId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PlantData plant = GetPlant(plantId);
            ExecutionEngine.Assert(plant.Owner != UInt160.Zero, "plant not found");
            ExecutionEngine.Assert(!plant.Harvested, "already harvested");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(fertilizer), "unauthorized");

            ValidatePaymentReceipt(APP_ID, fertilizer, FERTILIZE_FEE, receiptId);

            plant.FertilizeCount += 1;
            plant.RewardBonus += FERTILIZE_REWARD_BONUS;
            StorePlant(plantId, plant);

            OnPlantFertilized(plantId, fertilizer, FERTILIZE_REWARD_BONUS);
        }

        #endregion
    }
}
