using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppNeoGacha
    {
        #region User Methods
        public static BigInteger CreateMachine(
            UInt160 creator,
            string name,
            string description,
            string category,
            string tags,
            BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);

            ExecutionEngine.Assert(name != null && name.Length > 0, "name required");
            ExecutionEngine.Assert(name.Length <= MAX_NAME_LENGTH, "name too long");

            string safeDescription = description == null ? "" : description;
            ExecutionEngine.Assert(safeDescription.Length <= MAX_DESCRIPTION_LENGTH, "description too long");

            string safeCategory = category == null ? "" : category;
            ExecutionEngine.Assert(safeCategory.Length <= MAX_CATEGORY_LENGTH, "category too long");

            string safeTags = tags == null ? "" : tags;
            ExecutionEngine.Assert(safeTags.Length <= MAX_TAGS_LENGTH, "tags too long");

            ExecutionEngine.Assert(price > 0, "price must be > 0");

            GameBetLimitsConfig limits = GetGameBetLimits();
            ExecutionEngine.Assert(price <= limits.MaxBet, "price exceeds max bet");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            BigInteger machineId = TotalMachines() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MACHINE_ID, machineId);

            MachineData machine = new MachineData
            {
                Creator = creator,
                Owner = creator,
                Name = name,
                Description = safeDescription,
                Category = safeCategory,
                Tags = safeTags,
                Price = price,
                ItemCount = 0,
                TotalWeight = 0,
                Plays = 0,
                Revenue = 0,
                Sales = 0,
                SalesVolume = 0,
                CreatedAt = Runtime.Time,
                LastPlayedAt = 0,
                Active = false,
                Listed = true,
                Banned = false,
                Locked = false,
                SalePrice = 0
            };
            StoreMachine(machineId, machine);

            OnMachineCreated(creator, machineId);
            return machineId;
        }

        public static void UpdateMachine(
            UInt160 owner,
            BigInteger machineId,
            string name,
            string description,
            string category,
            string tags,
            BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            ExecutionEngine.Assert(name != null && name.Length > 0, "name required");
            ExecutionEngine.Assert(name.Length <= MAX_NAME_LENGTH, "name too long");

            string safeDescription = description == null ? "" : description;
            ExecutionEngine.Assert(safeDescription.Length <= MAX_DESCRIPTION_LENGTH, "description too long");

            string safeCategory = category == null ? "" : category;
            ExecutionEngine.Assert(safeCategory.Length <= MAX_CATEGORY_LENGTH, "category too long");

            string safeTags = tags == null ? "" : tags;
            ExecutionEngine.Assert(safeTags.Length <= MAX_TAGS_LENGTH, "tags too long");

            ExecutionEngine.Assert(price > 0, "price must be > 0");

            GameBetLimitsConfig limits = GetGameBetLimits();
            ExecutionEngine.Assert(price <= limits.MaxBet, "price exceeds max bet");

            machine.Name = name;
            machine.Description = safeDescription;
            machine.Category = safeCategory;
            machine.Tags = safeTags;
            machine.Price = price;

            StoreMachine(machineId, machine);
            OnMachineUpdated(machineId);
        }

        public static BigInteger AddMachineItem(
            UInt160 creator,
            BigInteger machineId,
            string name,
            BigInteger weight,
            string rarity,
            BigInteger assetType,
            UInt160 assetHash,
            BigInteger amount,
            string tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            ValidateOwnerOrAdmin(creator, machine);
            ExecutionEngine.Assert(!machine.Active, "machine active");
            ExecutionEngine.Assert(!machine.Locked, "items locked");

            ExecutionEngine.Assert(name != null && name.Length > 0, "item name required");
            ExecutionEngine.Assert(name.Length <= MAX_NAME_LENGTH, "item name too long");
            ExecutionEngine.Assert(weight > 0, "weight must be > 0");

            ExecutionEngine.Assert(machine.ItemCount < MAX_ITEMS_PER_MACHINE, "too many items");
            ExecutionEngine.Assert(machine.TotalWeight + weight <= MAX_TOTAL_WEIGHT, "total weight exceeded");

            string safeRarity = rarity == null ? "" : rarity;
            ExecutionEngine.Assert(safeRarity.Length <= MAX_RARITY_LENGTH, "rarity too long");

            ExecutionEngine.Assert(assetType == ASSET_NEP17 || assetType == ASSET_NEP11, "invalid asset type");
            ValidateAddress(assetHash);

            BigInteger decimals = 0;
            if (assetType == ASSET_NEP17)
            {
                ExecutionEngine.Assert(amount > 0, "amount must be > 0");
                decimals = (BigInteger)Contract.Call(assetHash, "decimals", CallFlags.ReadOnly);
            }

            string safeTokenId = tokenId == null ? "" : tokenId;

            BigInteger itemIndex = machine.ItemCount + 1;
            ItemData item = new ItemData
            {
                Name = name,
                Weight = weight,
                Rarity = safeRarity,
                AssetType = assetType,
                AssetHash = assetHash,
                Amount = amount,
                TokenId = safeTokenId,
                Stock = 0,
                TokenCount = 0,
                Decimals = decimals
            };

            StoreItem(machineId, itemIndex, item);

            machine.ItemCount = itemIndex;
            machine.TotalWeight = machine.TotalWeight + weight;
            StoreMachine(machineId, machine);

            OnMachineItemAdded(machineId, itemIndex);
            return itemIndex;
        }

        /// <summary>
        /// [DEPRECATED] O(n) item validation loop - use SetMachineActiveWithValidation instead.
        /// SetMachineActiveWithValidation uses O(1) spot check verification.
        /// </summary>


        public static void SetMachineListed(UInt160 owner, BigInteger machineId, bool listed)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            machine.Listed = listed;
            StoreMachine(machineId, machine);
            OnMachineListed(machineId, listed);
        }

        public static void SetMachineBanned(BigInteger machineId, bool banned)
        {
            ValidateAdmin();
            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            machine.Banned = banned;
            if (banned)
            {
                machine.Active = false;
                machine.Listed = false;
                machine.SalePrice = 0;
            }
            StoreMachine(machineId, machine);
            OnMachineBanned(machineId, banned);
        }

        public static void ListMachineForSale(UInt160 owner, BigInteger machineId, BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ExecutionEngine.Assert(price > 0, "price must be > 0");

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            machine.SalePrice = price;
            StoreMachine(machineId, machine);
            OnMachineSaleListed(machineId, price);
        }

        public static void CancelMachineSale(UInt160 owner, BigInteger machineId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            ValidateOwnerOrAdmin(owner, machine);

            machine.SalePrice = 0;
            StoreMachine(machineId, machine);
            OnMachineSaleListed(machineId, 0);
        }

        public static void BuyMachine(UInt160 buyer, BigInteger machineId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(buyer);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");
            ExecutionEngine.Assert(machine.SalePrice > 0, "not for sale");
            ExecutionEngine.Assert(machine.Owner != buyer, "already owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            BigInteger price = machine.SalePrice;
            ValidatePaymentReceipt(APP_ID, buyer, price, receiptId);

            UInt160 seller = machine.Owner;
            BigInteger platformFee = price * PLATFORM_FEE_BPS / 10000;
            BigInteger creatorRoyalty = machine.Creator == seller ? 0 : price * CREATOR_ROYALTY_BPS / 10000;

            machine.Owner = buyer;
            machine.SalePrice = 0;
            machine.Sales = machine.Sales + 1;
            machine.SalesVolume = machine.SalesVolume + price;

            StoreMachine(machineId, machine);

            OnMachineSold(machineId, seller, buyer, price, platformFee, creatorRoyalty);
        }

        public static void DepositItem(UInt160 owner, BigInteger machineId, BigInteger itemIndex, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            ItemData item = LoadItem(machineId, itemIndex);
            ExecutionEngine.Assert(item.Weight > 0, "item not found");
            ExecutionEngine.Assert(item.AssetType == ASSET_NEP17, "not NEP-17 item");
            ExecutionEngine.Assert(item.Amount > 0, "item amount missing");
            ExecutionEngine.Assert(amount % item.Amount == 0, "amount must align with prize unit");

            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                owner, Runtime.ExecutingScriptHash, amount, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock = item.Stock + amount;
            StoreItem(machineId, itemIndex, item);

            OnInventoryDeposited(machineId, itemIndex, amount, "");
        }

        public static void DepositItemToken(UInt160 owner, BigInteger machineId, BigInteger itemIndex, string tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            ItemData item = LoadItem(machineId, itemIndex);
            ExecutionEngine.Assert(item.Weight > 0, "item not found");
            ExecutionEngine.Assert(item.AssetType == ASSET_NEP11, "not NEP-11 item");
            string effectiveTokenId = tokenId == null || tokenId.Length == 0 ? item.TokenId : tokenId;
            ExecutionEngine.Assert(effectiveTokenId != null && effectiveTokenId.Length > 0, "tokenId required");
            if (item.TokenId != null && item.TokenId.Length > 0)
            {
                ExecutionEngine.Assert(item.TokenId == effectiveTokenId, "tokenId mismatch");
            }

            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                owner, Runtime.ExecutingScriptHash, effectiveTokenId, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.TokenCount = item.TokenCount + 1;
            StoreItemToken(machineId, itemIndex, item.TokenCount, effectiveTokenId);
            StoreItem(machineId, itemIndex, item);

            OnInventoryDeposited(machineId, itemIndex, 1, effectiveTokenId);
        }

        public static void WithdrawItem(UInt160 owner, BigInteger machineId, BigInteger itemIndex, BigInteger amount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Active, "machine active");

            ValidateOwnerOrAdmin(owner, machine);

            ItemData item = LoadItem(machineId, itemIndex);
            ExecutionEngine.Assert(item.Weight > 0, "item not found");
            ExecutionEngine.Assert(item.AssetType == ASSET_NEP17, "not NEP-17 item");
            ExecutionEngine.Assert(item.Stock >= amount, "insufficient stock");

            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, owner, amount, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock = item.Stock - amount;
            StoreItem(machineId, itemIndex, item);

            OnInventoryWithdrawn(machineId, itemIndex, amount, "");
        }

        public static void WithdrawItemToken(UInt160 owner, BigInteger machineId, BigInteger itemIndex, string tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Active, "machine active");

            ValidateOwnerOrAdmin(owner, machine);

            ItemData item = LoadItem(machineId, itemIndex);
            ExecutionEngine.Assert(item.Weight > 0, "item not found");
            ExecutionEngine.Assert(item.AssetType == ASSET_NEP11, "not NEP-11 item");
            ExecutionEngine.Assert(item.TokenCount > 0, "no tokens");

            string selectedTokenId = RemoveItemToken(machineId, itemIndex, ref item, tokenId);

            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, owner, selectedTokenId, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            StoreItem(machineId, itemIndex, item);

            OnInventoryWithdrawn(machineId, itemIndex, 1, selectedTokenId);
        }

        #endregion

        /// <summary>
        /// [DEPRECATED] Uses service callback + O(n) loops.
        /// Use InitiatePlayOptimized/SettlePlayOptimized instead.
        /// Frontend calculates selection, contract verifies with O(1) check.
        /// </summary>


        #region Token Receivers
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept NEP-17 transfers; inventory is managed via DepositItem.
        }

        public static void OnNEP11Payment(UInt160 from, ByteString tokenId, object data)
        {
            // Accept NEP-11 transfers; inventory is managed via DepositItemToken.
        }

        public static void OnNEP11Payment(UInt160 from, BigInteger amount, ByteString tokenId, object data)
        {
            // Accept NEP-11 divisible transfers (if any); inventory is managed via DepositItemToken.
        }
        #endregion
    }
}
