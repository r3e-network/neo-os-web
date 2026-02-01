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
    /// <summary>
    /// NeoGacha MiniApp - On-chain blind box marketplace with transparent odds.
    ///
    /// KEY FEATURES:
    /// - Create gacha machines with custom items
    /// - Weighted probability system
    /// - Escrowed prizes before draw
    /// - Verifiable randomness for draws
    /// - Machine marketplace (buy/sell machines)
    /// - Inventory management system
    /// - Hybrid mode with TEE verification
    ///
    /// SECURITY:
    /// - Escrow ensures prizes exist
    /// - Verifiable random number generation
    /// - Creator royalty on machine sales
    /// - Platform fee on plays
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for plays
    /// - NEP-17/NEP-11 token transfers for prizes
    /// </summary>
    [DisplayName("MiniAppNeoGacha")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "NeoGacha is an on-chain blind box marketplace with escrowed prizes, transparent odds, and verifiable randomness.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppNeoGacha : MiniAppGameComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the NeoGacha miniapp.</summary>
        /// <summary>Unique application identifier for the neo-gacha miniapp.</summary>
        private const string APP_ID = "miniapp-neo-gacha";
        
        /// <summary>Maximum items per machine.</summary>
        private const int MAX_ITEMS_PER_MACHINE = 100;
        
        /// <summary>Maximum machine name length.</summary>
        private const int MAX_NAME_LENGTH = 64;
        
        /// <summary>Maximum description length.</summary>
        private const int MAX_DESCRIPTION_LENGTH = 256;
        
        /// <summary>Maximum category length.</summary>
        private const int MAX_CATEGORY_LENGTH = 32;
        
        /// <summary>Maximum tags length.</summary>
        private const int MAX_TAGS_LENGTH = 128;
        
        /// <summary>Maximum rarity string length.</summary>
        private const int MAX_RARITY_LENGTH = 32;
        
        /// <summary>Maximum total weight (100%).</summary>
        private const int MAX_TOTAL_WEIGHT = 100;
        
        /// <summary>Platform fee 2.5% (250 bps).</summary>
        private const int PLATFORM_FEE_BPS = 250;
        
        /// <summary>Creator royalty 5% (500 bps) on machine sales.</summary>
        private const int CREATOR_ROYALTY_BPS = 500;
        
        /// <summary>Asset type: NEP-17 token.</summary>
        private const byte ASSET_NEP17 = 1;
        
        /// <summary>Asset type: NEP-11 NFT.</summary>
        private const byte ASSET_NEP11 = 2;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase)
        /// <summary>Prefix 0x40: Current machine ID counter.</summary>
        /// <summary>Storage prefix for machine id.</summary>
        private static readonly byte[] PREFIX_MACHINE_ID = new byte[] { 0x40 };
        
        /// <summary>Prefix 0x41: Machine data storage.</summary>
        /// <summary>Storage prefix for machines.</summary>
        private static readonly byte[] PREFIX_MACHINES = new byte[] { 0x41 };
        
        /// <summary>Prefix 0x42: Machine items storage.</summary>
        /// <summary>Storage prefix for machine items.</summary>
        private static readonly byte[] PREFIX_MACHINE_ITEMS = new byte[] { 0x42 };
        
        /// <summary>Prefix 0x43: Current play ID counter.</summary>
        /// <summary>Storage prefix for play id.</summary>
        private static readonly byte[] PREFIX_PLAY_ID = new byte[] { 0x43 };
        
        /// <summary>Prefix 0x44: Play data storage.</summary>
        /// <summary>Storage prefix for plays.</summary>
        private static readonly byte[] PREFIX_PLAYS = new byte[] { 0x44 };
        
        /// <summary>Prefix 0x45: Request to play mapping.</summary>
        /// <summary>Storage prefix for request to play.</summary>
        private static readonly byte[] PREFIX_REQUEST_TO_PLAY = new byte[] { 0x45 };
        
        /// <summary>Prefix 0x46: Item token list.</summary>
        /// <summary>Storage prefix for item token list.</summary>
        private static readonly byte[] PREFIX_ITEM_TOKEN_LIST = new byte[] { 0x46 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Gacha machine data.
        /// FIELDS:
        /// - Creator: Machine creator address
        /// - Owner: Current owner address
        /// - Name: Machine display name
        /// - Description: Machine description
        /// - Category: Machine category
        /// - Tags: Searchable tags
        /// - Price: Play price in GAS
        /// - ItemCount: Number of item types
        /// - TotalWeight: Sum of all item weights
        /// - Plays: Total play count
        /// - Revenue: Total revenue earned
        /// - Sales: Number of times machine sold
        /// - SalesVolume: Total GAS from sales
        /// - CreatedAt: Creation timestamp
        /// - LastPlayedAt: Last play timestamp
        /// - Active: Whether machine is active
        /// - Listed: Whether machine is publicly listed
        /// - Banned: Whether banned by admin
        /// - Locked: Whether locked during play
        /// - SalePrice: Current sale price (0 if not for sale)
        /// </summary>
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

        /// <summary>
        /// Gacha item data.
        /// FIELDS:
        /// - Name: Item display name
        /// - Weight: Probability weight
        /// - Rarity: Rarity string (e.g., "Common", "Rare")
        /// - AssetType: 1=NEP-17, 2=NEP-11
        /// - AssetHash: Token contract hash
        /// - Amount: Token amount (for NEP-17)
        /// - TokenId: Token ID (for NEP-11)
        /// - Stock: Remaining stock
        /// - TokenCount: Total tokens in inventory
        /// - Decimals: Token decimals
        /// </summary>
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

        /// <summary>
        /// Play session data.
        /// FIELDS:
        /// - Player: Player address
        /// - MachineId: Machine played
        /// - ItemIndex: Won item index
        /// - Price: Play price paid
        /// - Timestamp: Play timestamp
        /// - Resolved: Whether prize claimed
        /// - Seed: Random seed for hybrid mode
        /// - HybridMode: Whether using hybrid resolution
        /// </summary>
        public struct PlayData
        {
            public UInt160 Player;
            public BigInteger MachineId;
            public BigInteger ItemIndex;
            public BigInteger Price;
            public BigInteger Timestamp;
            public bool Resolved;
            public ByteString Seed;
            public bool HybridMode;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when machine is created.</summary>
        /// <param name="creator">Creator address.</param>
        /// <param name="machineId">New machine identifier.</param>
        /// <summary>Event emitted when machine created.</summary>
    public delegate void MachineCreatedHandler(UInt160 creator, BigInteger machineId);
        
        /// <summary>Event emitted when machine is updated.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <summary>Event emitted when machine updated.</summary>
    public delegate void MachineUpdatedHandler(BigInteger machineId);
        
        /// <summary>Event emitted when item is added to machine.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="itemIndex">Item index in machine.</param>
        /// <summary>Event emitted when machine item added.</summary>
    public delegate void MachineItemAddedHandler(BigInteger machineId, BigInteger itemIndex);
        
        /// <summary>Event emitted when machine activation changes.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="active">New active status.</param>
        /// <summary>Event emitted when machine activated.</summary>
    public delegate void MachineActivatedHandler(BigInteger machineId, bool active);
        
        /// <summary>Event emitted when machine listing changes.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="listed">New listed status.</param>
        /// <summary>Event emitted when machine listed.</summary>
    public delegate void MachineListedHandler(BigInteger machineId, bool listed);
        
        /// <summary>Event emitted when machine ban status changes.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="banned">New banned status.</param>
        /// <summary>Event emitted when machine banned.</summary>
    public delegate void MachineBannedHandler(BigInteger machineId, bool banned);
        
        /// <summary>Event emitted when machine is listed for sale.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="price">Sale price.</param>
        /// <summary>Event emitted when machine sale listed.</summary>
    public delegate void MachineSaleListedHandler(BigInteger machineId, BigInteger price);
        
        /// <summary>Event emitted when machine is sold.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="seller">Previous owner.</param>
        /// <param name="buyer">New owner.</param>
        /// <param name="price">Sale price.</param>
        /// <param name="platformFee">Platform fee paid.</param>
        /// <param name="creatorRoyalty">Creator royalty paid.</param>
        /// <summary>Event emitted when machine sold.</summary>
    public delegate void MachineSoldHandler(BigInteger machineId, UInt160 seller, UInt160 buyer, BigInteger price, BigInteger platformFee, BigInteger creatorRoyalty);
        
        /// <summary>Event emitted when inventory is deposited.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="itemIndex">Item index.</param>
        /// <param name="amount">Amount deposited.</param>
        /// <param name="tokenId">Token ID (for NFTs).</param>
        /// <summary>Event emitted when inventory deposited.</summary>
    public delegate void InventoryDepositedHandler(BigInteger machineId, BigInteger itemIndex, BigInteger amount, string tokenId);
        
        /// <summary>Event emitted when inventory is withdrawn.</summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="itemIndex">Item index.</param>
        /// <param name="amount">Amount withdrawn.</param>
        /// <param name="tokenId">Token ID (for NFTs).</param>
        /// <summary>Event emitted when inventory withdrawn.</summary>
    public delegate void InventoryWithdrawnHandler(BigInteger machineId, BigInteger itemIndex, BigInteger amount, string tokenId);
        
        /// <summary>Event emitted when play is requested.</summary>
        /// <param name="player">Player address.</param>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="playId">Play session identifier.</param>
        /// <param name="requestId">RNG request identifier.</param>
        /// <summary>Event emitted when play requested.</summary>
    public delegate void PlayRequestedHandler(UInt160 player, BigInteger machineId, BigInteger playId, BigInteger requestId);
        
        /// <summary>Event emitted when play is initiated.</summary>
        /// <param name="player">Player address.</param>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="playId">Play session identifier.</param>
        /// <param name="seed">Random seed.</param>
        /// <summary>Event emitted when play initiated.</summary>
    public delegate void PlayInitiatedHandler(UInt160 player, BigInteger machineId, BigInteger playId, string seed);
        
        /// <summary>Event emitted when play is resolved.</summary>
        /// <param name="player">Player address.</param>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="itemIndex">Won item index.</param>
        /// <param name="playId">Play session identifier.</param>
        /// <param name="assetType">Asset type won.</param>
        /// <param name="assetHash">Asset contract hash.</param>
        /// <param name="amount">Amount won.</param>
        /// <param name="tokenId">Token ID won.</param>
        /// <summary>Event emitted when play resolved.</summary>
    public delegate void PlayResolvedHandler(UInt160 player, BigInteger machineId, BigInteger itemIndex, BigInteger playId, BigInteger assetType, UInt160 assetHash, BigInteger amount, string tokenId);
        
        /// <summary>Event emitted when RNG is requested.</summary>
        /// <param name="playId">Play session identifier.</param>
        /// <param name="requestId">RNG request identifier.</param>
        /// <summary>Event emitted when rng requested.</summary>
    public delegate void RngRequestedHandler(BigInteger playId, BigInteger requestId);
        #endregion

        #region Events
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
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MACHINE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_PLAY_ID, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total machines created.
        /// </summary>
        /// <returns>Total machine count.</returns>
        [Safe]
        public static BigInteger TotalMachines() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MACHINE_ID);

        /// <summary>
        /// Gets machine data as Map.
        /// </summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <returns>Machine data as Map.</returns>
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

        /// <summary>
        /// Gets item data as Map.
        /// </summary>
        /// <param name="machineId">Machine identifier.</param>
        /// <param name="itemIndex">Item index.</param>
        /// <returns>Item data as Map.</returns>
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

        /// <summary>
        /// Gets play data as Map.
        /// </summary>
        /// <param name="playId">Play identifier.</param>
        /// <returns>Play data as Map.</returns>
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
