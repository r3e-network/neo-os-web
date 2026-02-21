using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void PlantSeededHandler(UInt160 owner, BigInteger plantId, int seedType);
    public delegate void PlantGrownHandler(BigInteger plantId, int color, int size);
    public delegate void PlantHarvestedHandler(UInt160 owner, BigInteger plantId, BigInteger reward);

    /// <summary>
    /// Garden of NEO - Plants grow based on blockchain data.
    ///
    /// GAME MECHANICS:
    /// - Users plant seeds that grow based on chain metrics
    /// - Growth factors: TPS, block height, GAS burned
    /// - Plant appearance changes with network activity
    /// - Harvest rewards based on plant maturity
    /// </summary>
    [DisplayName("MiniAppGardenOfNeo")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GardenOfNeo is an interactive gaming application for blockchain-powered gardening. Use it to plant and grow virtual seeds, you can harvest rewards based on network activity and plant maturity.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-garden-of-neo";
        private const long PLANT_FEE = 10000000; // 0.1 GAS
        private const int GROWTH_BLOCKS = 100; // Blocks to mature
        #endregion

        #region Seed Types
        private const int SEED_FIRE = 1;
        private const int SEED_ICE = 2;
        private const int SEED_EARTH = 3;
        private const int SEED_WIND = 4;
        private const int SEED_LIGHT = 5;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PLANT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PLANT_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PLANT_SEED = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_PLANT_BLOCK = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_PLANT_HARVESTED = new byte[] { 0x14 };
        #endregion

        #region Events
        [DisplayName("PlantSeeded")]
        public static event PlantSeededHandler OnPlantSeeded;

        [DisplayName("PlantGrown")]
        public static event PlantGrownHandler OnPlantGrown;

        [DisplayName("PlantHarvested")]
        public static event PlantHarvestedHandler OnPlantHarvested;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalPlants() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PLANT_ID);

        [Safe]
        public static BigInteger PlantBlock(BigInteger plantId)
        {
            byte[] key = Helper.Concat(PREFIX_PLANT_BLOCK, (ByteString)plantId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool IsHarvested(BigInteger plantId)
        {
            byte[] key = Helper.Concat(PREFIX_PLANT_HARVESTED, (ByteString)plantId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PLANT_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Plant a new seed.
        /// </summary>
        public static void Plant(UInt160 owner, int seedType, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(seedType >= SEED_FIRE && seedType <= SEED_LIGHT, "invalid seed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, PLANT_FEE, receiptId);

            BigInteger plantId = TotalPlants() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PLANT_ID, plantId);

            byte[] ownerKey = Helper.Concat(PREFIX_PLANT_OWNER, (ByteString)plantId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, owner);

            byte[] seedKey = Helper.Concat(PREFIX_PLANT_SEED, (ByteString)plantId.ToByteArray());
            Storage.Put(Storage.CurrentContext, seedKey, seedType);

            byte[] blockKey = Helper.Concat(PREFIX_PLANT_BLOCK, (ByteString)plantId.ToByteArray());
            Storage.Put(Storage.CurrentContext, blockKey, Ledger.CurrentIndex);

            OnPlantSeeded(owner, plantId, seedType);
        }

        /// <summary>
        /// Check plant growth status.
        /// </summary>
        [Safe]
        public static object[] GetPlantStatus(BigInteger plantId)
        {
            BigInteger birthBlock = PlantBlock(plantId);
            BigInteger currentBlock = Ledger.CurrentIndex;
            BigInteger age = currentBlock - birthBlock;

            // Calculate growth based on block data
            int size = (int)(age * 100 / GROWTH_BLOCKS);
            if (size > 100) size = 100;

            // Color based on current block hash
            int color = (int)(currentBlock % 6);

            return new object[] { size, color, age >= GROWTH_BLOCKS };
        }

        /// <summary>
        /// Harvest a mature plant.
        /// </summary>
        public static void Harvest(UInt160 owner, BigInteger plantId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(!IsHarvested(plantId), "already harvested");

            byte[] ownerKey = Helper.Concat(PREFIX_PLANT_OWNER, (ByteString)plantId.ToByteArray());
            UInt160 plantOwner = (UInt160)Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(plantOwner == owner, "not owner");

            BigInteger birthBlock = PlantBlock(plantId);
            BigInteger age = Ledger.CurrentIndex - birthBlock;
            ExecutionEngine.Assert(age >= GROWTH_BLOCKS, "not mature");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            byte[] harvestKey = Helper.Concat(PREFIX_PLANT_HARVESTED, (ByteString)plantId.ToByteArray());
            Storage.Put(Storage.CurrentContext, harvestKey, 1);

            // Reward based on seed type and growth time
            byte[] seedKey = Helper.Concat(PREFIX_PLANT_SEED, (ByteString)plantId.ToByteArray());
            int seedType = (int)(BigInteger)Storage.Get(Storage.CurrentContext, seedKey);
            BigInteger reward = seedType * 5000000; // 0.05 GAS per seed level

            OnPlantHarvested(owner, plantId, reward);
        }

        #endregion
    }
}
