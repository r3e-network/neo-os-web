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
    // Event delegates for garden lifecycle
    public delegate void PlantSeededHandler(UInt160 owner, BigInteger plantId, BigInteger seedType, string name);
    public delegate void PlantGrownHandler(BigInteger plantId, BigInteger growthStage, BigInteger size);
    public delegate void PlantHarvestedHandler(UInt160 owner, BigInteger plantId, BigInteger reward);
    public delegate void PlantWateredHandler(BigInteger plantId, UInt160 waterer, BigInteger waterBonus);
    public delegate void PlantFertilizedHandler(BigInteger plantId, UInt160 fertilizer, BigInteger growthBoost);
    public delegate void GardenCreatedHandler(UInt160 owner, BigInteger gardenId, string name);
    public delegate void SeasonChangedHandler(BigInteger seasonId, BigInteger seasonType, BigInteger startTime);
    public delegate void AchievementUnlockedHandler(UInt160 user, BigInteger achievementId, string name);

    /// <summary>
    /// Garden of NEO MiniApp - Complete blockchain-powered virtual gardening platform.
    /// </summary>
    [DisplayName("MiniAppGardenOfNeo")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GardenOfNeo is a complete blockchain-powered gardening platform with multiple seed types, garden plots, seasonal events, watering/fertilizing mechanics, achievements, and plant trading.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppGardenOfNeo : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-garden-of-neo";
        private const long PLANT_FEE = 10000000;
        private const long WATER_FEE = 5000000;
        private const long FERTILIZE_FEE = 20000000;
        private const long GARDEN_FEE = 100000000;
        private const int GROWTH_BLOCKS = 100;
        private const int MAX_PLANTS_PER_GARDEN = 20;
        private const int MAX_WATER_PER_DAY = 3;
        private const int WATER_GROWTH_BONUS = 10;
        private const int FERTILIZE_REWARD_BONUS = 20;
        private const int MAX_NAME_LENGTH = 50;
        private const int SEASON_DURATION_SECONDS = 604800;
        #endregion

        #region Seed Types and Rewards
        private const int SEED_FIRE = 1;
        private const int SEED_ICE = 2;
        private const int SEED_EARTH = 3;
        private const int SEED_WIND = 4;
        private const int SEED_LIGHT = 5;
        private const int SEED_DARK = 6;
        private const int SEED_RARE = 7;
        private const long REWARD_FIRE = 15000000;
        private const long REWARD_ICE = 15000000;
        private const long REWARD_EARTH = 20000000;
        private const long REWARD_WIND = 20000000;
        private const long REWARD_LIGHT = 30000000;
        private const long REWARD_DARK = 30000000;
        private const long REWARD_RARE = 100000000;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PLANT_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_PLANTS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_GARDEN_ID = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_GARDENS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_PLANTS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_USER_PLANT_COUNT = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_SEASON = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_HARVESTED = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_REWARDS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_WATER_COUNT = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        public struct PlantData
        {
            public UInt160 Owner;
            public string Name;
            public BigInteger SeedType;
            public BigInteger PlantedBlock;
            public BigInteger PlantedTime;
            public BigInteger WaterCount;
            public BigInteger FertilizeCount;
            public BigInteger GrowthBonus;
            public BigInteger RewardBonus;
            public bool Harvested;
            public BigInteger HarvestTime;
            public BigInteger HarvestReward;
        }

        public struct GardenData
        {
            public UInt160 Owner;
            public string Name;
            public BigInteger CreatedTime;
            public BigInteger PlantCount;
            public BigInteger TotalHarvested;
            public BigInteger TotalRewards;
            public bool Active;
        }

        public struct UserStats
        {
            public BigInteger TotalPlanted;
            public BigInteger TotalHarvested;
            public BigInteger TotalRewards;
            public BigInteger TotalSpent;
            public BigInteger FavoriteSeed;
            public BigInteger GardenCount;
            public BigInteger LastPlantTime;
            public BigInteger CurrentStreak;
        }

        public struct SeasonData
        {
            public BigInteger Id;
            public BigInteger SeasonType;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger BonusSeedType;
        }
        #endregion

        #region Events
        [DisplayName("PlantSeeded")]
        public static event PlantSeededHandler OnPlantSeeded;

        [DisplayName("PlantGrown")]
        public static event PlantGrownHandler OnPlantGrown;

        [DisplayName("PlantHarvested")]
        public static event PlantHarvestedHandler OnPlantHarvested;

        [DisplayName("PlantWatered")]
        public static event PlantWateredHandler OnPlantWatered;

        [DisplayName("PlantFertilized")]
        public static event PlantFertilizedHandler OnPlantFertilized;

        [DisplayName("GardenCreated")]
        public static event GardenCreatedHandler OnGardenCreated;

        [DisplayName("SeasonChanged")]
        public static event SeasonChangedHandler OnSeasonChanged;

        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalPlants() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PLANT_ID);

        [Safe]
        public static BigInteger TotalGardens() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GARDEN_ID);

        [Safe]
        public static BigInteger TotalHarvested() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_HARVESTED);

        [Safe]
        public static BigInteger TotalRewardsDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REWARDS);

        [Safe]
        public static PlantData GetPlant(BigInteger plantId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLANTS, (ByteString)plantId.ToByteArray()));
            if (data == null) return new PlantData();
            return (PlantData)StdLib.Deserialize(data);
        }

        [Safe]
        public static GardenData GetGarden(BigInteger gardenId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GARDENS, (ByteString)gardenId.ToByteArray()));
            if (data == null) return new GardenData();
            return (GardenData)StdLib.Deserialize(data);
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static SeasonData GetCurrentSeason()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_SEASON);
            if (data == null) return new SeasonData();
            return (SeasonData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserPlantCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_PLANT_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PLANT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_GARDEN_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HARVESTED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDS, 0);

            SeasonData season = new SeasonData
            {
                Id = 1,
                SeasonType = 1,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + SEASON_DURATION_SECONDS,
                BonusSeedType = SEED_EARTH
            };
            Storage.Put(Storage.CurrentContext, PREFIX_SEASON, StdLib.Serialize(season));
        }
        #endregion
    }
}
