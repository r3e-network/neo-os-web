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
    public delegate void MachineCreatedHandler(UInt160 creator, BigInteger machineId);
    public delegate void MachineUpdatedHandler(BigInteger machineId);
    public delegate void MachineItemAddedHandler(BigInteger machineId, BigInteger itemIndex);
    public delegate void MachineActivatedHandler(BigInteger machineId, bool active);
    public delegate void MachineListedHandler(BigInteger machineId, bool listed);
    public delegate void MachineBannedHandler(BigInteger machineId, bool banned);
    public delegate void MachineSaleListedHandler(BigInteger machineId, BigInteger price);
    public delegate void MachineSoldHandler(BigInteger machineId, UInt160 seller, UInt160 buyer, BigInteger price, BigInteger platformFee, BigInteger creatorRoyalty);
    public delegate void InventoryDepositedHandler(BigInteger machineId, BigInteger itemIndex, BigInteger amount, string tokenId);
    public delegate void InventoryWithdrawnHandler(BigInteger machineId, BigInteger itemIndex, BigInteger amount, string tokenId);
    public delegate void PlayRequestedHandler(UInt160 player, BigInteger machineId, BigInteger playId, BigInteger requestId);
    public delegate void PlayInitiatedHandler(UInt160 player, BigInteger machineId, BigInteger playId, string seed);
    public delegate void PlayResolvedHandler(UInt160 player, BigInteger machineId, BigInteger itemIndex, BigInteger playId, BigInteger assetType, UInt160 assetHash, BigInteger amount, string tokenId);
    public delegate void RngRequestedHandler(BigInteger playId, BigInteger requestId);

    [DisplayName("MiniAppNeoGacha")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. NeoGacha is an on-chain blind box marketplace with escrowed prizes, transparent odds, and verifiable randomness.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppNeoGacha : MiniAppGameComputeBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-neo-gacha";
        private const int MAX_ITEMS_PER_MACHINE = 100;
        private const int MAX_NAME_LENGTH = 64;
        private const int MAX_DESCRIPTION_LENGTH = 256;
        private const int MAX_CATEGORY_LENGTH = 32;
        private const int MAX_TAGS_LENGTH = 128;
        private const int MAX_RARITY_LENGTH = 32;
        private const int MAX_TOTAL_WEIGHT = 100;
        private const int PLATFORM_FEE_BPS = 250;
        private const int CREATOR_ROYALTY_BPS = 500;
        private const byte ASSET_NEP17 = 1;
        private const byte ASSET_NEP11 = 2;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase 0x30-0x3F)
        private static readonly byte[] PREFIX_MACHINE_ID = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_MACHINES = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_MACHINE_ITEMS = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_PLAY_ID = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_PLAYS = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_REQUEST_TO_PLAY = new byte[] { 0x45 };
        private static readonly byte[] PREFIX_ITEM_TOKEN_LIST = new byte[] { 0x46 };
        #endregion

        #region Data Structures
        public struct MachineData
        {
            public UInt160 Creator;
            public UInt160 Owner;
            public string Name;
            public string Description;
            public string Category;
            public string Tags;
            public BigInteger Price;
            public BigInteger ItemCount;
            public BigInteger TotalWeight;
            public BigInteger Plays;
            public BigInteger Revenue;
            public BigInteger Sales;
            public BigInteger SalesVolume;
            public BigInteger CreatedAt;
            public BigInteger LastPlayedAt;
            public bool Active;
            public bool Listed;
            public bool Banned;
            public bool Locked;
            public BigInteger SalePrice;
        }

        public struct ItemData
        {
            public string Name;
            public BigInteger Weight;
            public string Rarity;
            public BigInteger AssetType;
            public UInt160 AssetHash;
            public BigInteger Amount;
            public string TokenId;
            public BigInteger Stock;
            public BigInteger TokenCount;
            public BigInteger Decimals;
        }

        public struct PlayData
        {
            public UInt160 Player;
            public BigInteger MachineId;
            public BigInteger ItemIndex;
            public BigInteger Price;
            public BigInteger Timestamp;
            public bool Resolved;
            public ByteString Seed;        // Deterministic seed for hybrid mode
            public bool HybridMode;        // True if using hybrid (seed-based) resolution
        }
        #endregion

        #region App Events
        [DisplayName("MachineCreated")]
        public static event MachineCreatedHandler OnMachineCreated;

        [DisplayName("MachineUpdated")]
        public static event MachineUpdatedHandler OnMachineUpdated;

        [DisplayName("MachineItemAdded")]
        public static event MachineItemAddedHandler OnMachineItemAdded;

        [DisplayName("MachineActivated")]
        public static event MachineActivatedHandler OnMachineActivated;

        [DisplayName("MachineListed")]
        public static event MachineListedHandler OnMachineListed;

        [DisplayName("MachineBanned")]
        public static event MachineBannedHandler OnMachineBanned;

        [DisplayName("MachineSaleListed")]
        public static event MachineSaleListedHandler OnMachineSaleListed;

        [DisplayName("MachineSold")]
        public static event MachineSoldHandler OnMachineSold;

        [DisplayName("InventoryDeposited")]
        public static event InventoryDepositedHandler OnInventoryDeposited;

        [DisplayName("InventoryWithdrawn")]
        public static event InventoryWithdrawnHandler OnInventoryWithdrawn;

        [DisplayName("PlayRequested")]
        public static event PlayRequestedHandler OnPlayRequested;

        [DisplayName("PlayInitiated")]
        public static event PlayInitiatedHandler OnPlayInitiated;

        [DisplayName("PlayResolved")]
        public static event PlayResolvedHandler OnPlayResolved;

        [DisplayName("RngRequested")]
        public static event RngRequestedHandler OnRngRequested;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MACHINE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PLAY_ID, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalMachines() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MACHINE_ID);

        [Safe]
        public static Map<string, object> GetMachine(BigInteger machineId)
        {
            MachineData data = LoadMachine(machineId);
            Map<string, object> machine = new Map<string, object>();
            if (data.Creator == UInt160.Zero) return machine;
            machine["id"] = machineId;
            machine["creator"] = data.Creator;
            machine["owner"] = data.Owner;
            machine["name"] = data.Name;
            machine["description"] = data.Description;
            machine["category"] = data.Category;
            machine["tags"] = data.Tags;
            machine["price"] = data.Price;
            machine["itemCount"] = data.ItemCount;
            machine["totalWeight"] = data.TotalWeight;
            machine["plays"] = data.Plays;
            machine["revenue"] = data.Revenue;
            machine["sales"] = data.Sales;
            machine["salesVolume"] = data.SalesVolume;
            machine["createdAt"] = data.CreatedAt;
            machine["lastPlayedAt"] = data.LastPlayedAt;
            machine["active"] = data.Active;
            machine["listed"] = data.Listed;
            machine["banned"] = data.Banned;
            machine["locked"] = data.Locked;
            machine["salePrice"] = data.SalePrice;
            return machine;
        }

        [Safe]
        public static Map<string, object> GetMachineItem(BigInteger machineId, BigInteger itemIndex)
        {
            ItemData data = LoadItem(machineId, itemIndex);
            Map<string, object> item = new Map<string, object>();
            if (data.Weight == 0) return item;
            item["name"] = data.Name;
            item["weight"] = data.Weight;
            item["rarity"] = data.Rarity;
            item["assetType"] = data.AssetType;
            item["assetHash"] = data.AssetHash;
            item["amount"] = data.Amount;
            item["tokenId"] = data.TokenId;
            item["stock"] = data.Stock;
            item["tokenCount"] = data.TokenCount;
            item["decimals"] = data.Decimals;
            return item;
        }

        [Safe]
        public static Map<string, object> GetPlay(BigInteger playId)
        {
            PlayData data = LoadPlay(playId);
            Map<string, object> play = new Map<string, object>();
            if (data.Player == UInt160.Zero) return play;
            play["id"] = playId;
            play["player"] = data.Player;
            play["machineId"] = data.MachineId;
            play["itemIndex"] = data.ItemIndex;
            play["price"] = data.Price;
            play["timestamp"] = data.Timestamp;
            play["resolved"] = data.Resolved;
            return play;
        }
        #endregion
    }
}
