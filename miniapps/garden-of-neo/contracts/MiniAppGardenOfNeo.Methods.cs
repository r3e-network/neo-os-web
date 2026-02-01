using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region User Methods

        /// <summary>
        /// Create a new garden plot.
        /// </summary>
        public static BigInteger CreateGarden(UInt160 owner, string name, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(name.Length > 0 && name.Length <= MAX_NAME_LENGTH, "invalid name");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, GARDEN_FEE, receiptId);

            BigInteger gardenId = TotalGardens() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_GARDEN_ID, gardenId);

            GardenData garden = new GardenData
            {
                Owner = owner,
                Name = name,
                CreatedTime = Runtime.Time,
                PlantCount = 0,
                TotalHarvested = 0,
                TotalRewards = 0,
                Active = true
            };
            StoreGarden(gardenId, garden);

            UserStats stats = GetUserStats(owner);
            stats.GardenCount += 1;
            stats.TotalSpent += GARDEN_FEE;
            StoreUserStats(owner, stats);

            OnGardenCreated(owner, gardenId, name);
            return gardenId;
        }

        #endregion
    }
}
