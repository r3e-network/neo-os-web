using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Gacha (GASBox) game module
    //
    //  Ported from MiniAppGASBox.  Every method takes appId as its
    //  first parameter and all storage is namespaced via AppKey().
    //
    //  GAME MECHANICS:
    //  - Operators create machines with weighted prize items
    //  - Items are NEP-17 tokens or NEP-11 NFTs with escrowed inventory
    //  - Players pay GAS to pull; Morpheus VRF selects the prize
    //  - Settlement verifies the selection on-chain and transfers the asset
    //  - Transparent odds via on-chain weights, verifiable randomness
    //
    //  SECURITY:
    //  - Oracle request is stored before resolution
    //  - On-chain re-derivation of selected item at settlement
    //  - Reentrancy guard on all state-changing operations
    //  - Only machine owner/admin can manage inventory
    // ===================================================================
    public partial class PlatformGameContract
    {
        // ---------------------------------------------------------------
        //  Gacha constants
        // ---------------------------------------------------------------
        private const int GA_MAX_ITEMS_PER_MACHINE = 100;
        private const int GA_MAX_NAME_LENGTH       = 64;
        private const int GA_MAX_DESC_LENGTH       = 256;
        private const int GA_MAX_CATEGORY_LENGTH   = 32;
        private const int GA_MAX_TOTAL_WEIGHT      = 100;
        private const byte GA_ASSET_NEP17          = 1;
        private const byte GA_ASSET_NEP11          = 2;

        // ---------------------------------------------------------------
        //  Gacha storage prefixes (0xC0 - 0xDF)
        // ---------------------------------------------------------------
        private static readonly byte[] GA_PREFIX_MACHINE_ID     = new byte[] { 0xC0 };
        private static readonly byte[] GA_PREFIX_MACHINES       = new byte[] { 0xC1 };
        private static readonly byte[] GA_PREFIX_MACHINE_ITEMS  = new byte[] { 0xC2 };
        private static readonly byte[] GA_PREFIX_PLAY_ID        = new byte[] { 0xC3 };
        private static readonly byte[] GA_PREFIX_PLAYS          = new byte[] { 0xC4 };
        private static readonly byte[] GA_PREFIX_REQ_TO_PLAY    = new byte[] { 0xC5 };
        private static readonly byte[] GA_PREFIX_ITEM_TOKENS    = new byte[] { 0xC6 };
        private static readonly byte[] GA_PREFIX_PENDING_ASSET  = new byte[] { 0xC7 };
        private const string GA_INVENTORY_MEMO_SUFFIX           = ":gacha-inventory";

        // ---------------------------------------------------------------
        //  Gacha data structures
        // ---------------------------------------------------------------
        public struct GachaMachine
        {
            public UInt160 Creator;
            public UInt160 Owner;
            public string Name;
            public string Description;
            public string Category;
            public BigInteger Price;       // cost per pull in GAS
            public BigInteger ItemCount;
            public BigInteger TotalWeight;
            public BigInteger Plays;
            public BigInteger Revenue;
            public BigInteger CreatedAt;
            public BigInteger LastPlayedAt;
            public bool Active;
            public bool Banned;
        }

        public struct GachaItem
        {
            public string Name;
            public BigInteger Weight;
            public string Rarity;
            public BigInteger AssetType;   // GA_ASSET_NEP17 or GA_ASSET_NEP11
            public UInt160 AssetHash;
            public BigInteger Amount;      // prize amount for NEP-17
            public string TokenId;         // for NEP-11
            public BigInteger Stock;       // available NEP-17 units
            public BigInteger TokenCount;  // available NEP-11 tokens
        }

        public struct GachaPlay
        {
            public UInt160 Player;
            public BigInteger MachineId;
            public BigInteger ItemIndex;   // 0 until resolved
            public BigInteger Price;
            public BigInteger Timestamp;
            public bool Resolved;
            public ByteString Seed;
        }

        // ---------------------------------------------------------------
        //  Gacha events
        // ---------------------------------------------------------------
        public delegate void GachaMachineCreatedHandler(string appId, UInt160 creator, BigInteger machineId);
        public delegate void GachaPlayInitiatedHandler(string appId, UInt160 player, BigInteger machineId, BigInteger playId, ByteString seed);
        public delegate void GachaPlayResolvedHandler(string appId, UInt160 player, BigInteger machineId, BigInteger itemIndex, BigInteger playId, BigInteger assetType, UInt160 assetHash, BigInteger amount, string tokenId);
        public delegate void GachaMachineActivatedHandler(string appId, BigInteger machineId, bool active);

        [DisplayName("GachaMachineCreated")]
        public static event GachaMachineCreatedHandler OnGachaMachineCreated;

        [DisplayName("GachaPlayInitiated")]
        public static event GachaPlayInitiatedHandler OnGachaPlayInitiated;

        [DisplayName("GachaPlayResolved")]
        public static event GachaPlayResolvedHandler OnGachaPlayResolved;

        [DisplayName("GachaMachineActivated")]
        public static event GachaMachineActivatedHandler OnGachaMachineActivated;

        // ===================================================================
        //  Machine management
        // ===================================================================

        /// <summary>
        /// Create a new gacha machine.
        ///
        /// Parameters:
        ///   appId     - registered gacha appId
        ///   creator   - address of the machine creator (must have witness)
        ///   name      - display name (max 64 chars)
        ///   price     - GAS cost per pull
        /// Returns: machineId
        /// </summary>
        public static BigInteger CreateGachaMachine(
            string appId,
            string name,
            BigInteger price)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            UInt160 creator = Runtime.Transaction.Sender;
            ValidateUserOrAbstractAccount(creator);

            ExecutionEngine.Assert(name != null && name.Length > 0, "name required");
            ExecutionEngine.Assert(name.Length <= GA_MAX_NAME_LENGTH, "name too long");
            ExecutionEngine.Assert(price > 0, "price must be > 0");

            BigInteger machineId = AppGetInt(appId, GA_PREFIX_MACHINE_ID) + 1;
            AppPut(appId, GA_PREFIX_MACHINE_ID, machineId);

            GachaMachine machine = new GachaMachine
            {
                Creator = creator,
                Owner = creator,
                Name = name,
                Description = "",
                Category = "",
                Price = price,
                ItemCount = 0,
                TotalWeight = 0,
                Plays = 0,
                Revenue = 0,
                CreatedAt = Runtime.Time,
                LastPlayedAt = 0,
                Active = false,
                Banned = false
            };
            StoreGachaMachine(appId, machineId, machine);

            OnGachaMachineCreated(appId, creator, machineId);
            return machineId;
        }

        /// <summary>
        /// Add a prize item to a gacha machine.
        /// Machine must be inactive and caller must be owner/admin.
        ///
        /// Returns: itemIndex (1-based)
        /// </summary>
        public static BigInteger AddGachaItem(
            string appId,
            BigInteger machineId,
            string name,
            BigInteger weight,
            string rarity,
            BigInteger assetType,
            UInt160 assetHash,
            BigInteger amount,
            string tokenId)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Active, "machine active");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            RequireGachaMachineOwnerOrAdmin(appId, machine);

            ExecutionEngine.Assert(name != null && name.Length > 0, "item name required");
            ExecutionEngine.Assert(name.Length <= GA_MAX_NAME_LENGTH, "item name too long");
            ExecutionEngine.Assert(weight > 0, "weight must be > 0");
            ExecutionEngine.Assert(machine.ItemCount < GA_MAX_ITEMS_PER_MACHINE, "too many items");
            ExecutionEngine.Assert(machine.TotalWeight + weight <= GA_MAX_TOTAL_WEIGHT, "total weight exceeded");
            ExecutionEngine.Assert(assetType == GA_ASSET_NEP17 || assetType == GA_ASSET_NEP11, "invalid asset type");
            ValidateAddress(assetHash);

            if (assetType == GA_ASSET_NEP17)
            {
                ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            }

            string safeRarity = rarity == null ? "" : rarity;
            string safeTokenId = tokenId == null ? "" : tokenId;

            BigInteger itemIndex = machine.ItemCount + 1;
            GachaItem item = new GachaItem
            {
                Name = name,
                Weight = weight,
                Rarity = safeRarity,
                AssetType = assetType,
                AssetHash = assetHash,
                Amount = amount,
                TokenId = safeTokenId,
                Stock = 0,
                TokenCount = 0
            };
            StoreGachaItem(appId, machineId, itemIndex, item);

            machine.ItemCount = itemIndex;
            machine.TotalWeight += weight;
            StoreGachaMachine(appId, machineId, machine);

            return itemIndex;
        }

        /// <summary>
        /// Activate or deactivate a gacha machine.
        /// When activating: must have items, total weight == 100, price > 0,
        /// and at least one item must have inventory.
        /// </summary>
        public static void SetGachaMachineActive(
            string appId,
            BigInteger machineId,
            bool active,
            BigInteger sampleItemIndex)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            RequireGachaMachineOwnerOrAdmin(appId, machine);

            if (active)
            {
                ExecutionEngine.Assert(machine.ItemCount > 0, "no items");
                ExecutionEngine.Assert(machine.TotalWeight == GA_MAX_TOTAL_WEIGHT, "total weight must be 100");
                ExecutionEngine.Assert(machine.Price > 0, "price required");

                // O(1) spot check: verify sample item has inventory
                ExecutionEngine.Assert(
                    sampleItemIndex > 0 && sampleItemIndex <= machine.ItemCount,
                    "invalid sample item");
                GachaItem sampleItem = LoadGachaItem(appId, machineId, sampleItemIndex);
                ExecutionEngine.Assert(IsGachaItemAvailable(sampleItem), "sample item unavailable");
            }

            machine.Active = active;
            StoreGachaMachine(appId, machineId, machine);
            OnGachaMachineActivated(appId, machineId, active);
        }

        /// <summary>
        /// Deposit NEP-17 inventory into a machine item.
        /// The tokens must have been transferred to this contract first.
        /// </summary>
        public static void DepositGachaItem(
            string appId,
            UInt160 owner,
            BigInteger machineId,
            BigInteger itemIndex,
            BigInteger amount)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);
            ValidateAddress(owner);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            RequireGachaMachineOwnerOrAdmin(appId, machine);

            GachaItem item = LoadGachaItem(appId, machineId, itemIndex);
            ExecutionEngine.Assert(item.Weight > 0, "item not found");
            ExecutionEngine.Assert(item.AssetType == GA_ASSET_NEP17, "not NEP-17 item");
            ExecutionEngine.Assert(item.Amount > 0, "item amount missing");
            ExecutionEngine.Assert(amount % item.Amount == 0, "amount must align with prize unit");

            byte[] pendingKey = AppKey(appId, GA_PREFIX_PENDING_ASSET, owner);
            Storage.Put(Storage.CurrentContext, pendingKey, amount);

            string inventoryMemo = appId + GA_INVENTORY_MEMO_SUFFIX + ":" + machineId + ":" + itemIndex;
            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                owner, Runtime.ExecutingScriptHash, amount, (ByteString)inventoryMemo);
            Storage.Delete(Storage.CurrentContext, pendingKey);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock += amount;
            StoreGachaItem(appId, machineId, itemIndex, item);
        }

        private static bool ConsumePendingGachaInventoryPayment(
            string appId,
            UInt160 from,
            BigInteger amount,
            object data)
        {
            string memo = ReadPaymentMemo(data);
            if (!memo.StartsWith(appId + GA_INVENTORY_MEMO_SUFFIX))
            {
                return false;
            }

            byte[] pendingKey = AppKey(appId, GA_PREFIX_PENDING_ASSET, from);
            ByteString pending = Storage.Get(Storage.CurrentContext, pendingKey);
            ExecutionEngine.Assert(pending != null && (BigInteger)pending == amount, "invalid gacha inventory deposit");
            Storage.Delete(Storage.CurrentContext, pendingKey);
            return true;
        }
    }
}
