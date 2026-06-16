using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        /// <summary>
        /// Create a new gacha machine.
        /// </summary>
        public static BigInteger CreateGachaMachine(
            string appId,
            UInt160 creator,
            string name,
            BigInteger price)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            // Audit fix NEW-H-3: identify the creator via an explicit parameter
            // and witness check rather than `Runtime.Transaction.Sender`. The
            // previous Tx.Sender approach failed for multi-sig and AA contract
            // accounts where the first signer's script-hash is not the user's
            // intended owner identity. Now mirrors PlatformSocial.Trust.ExecuteTrust
            // (audit fix M-7).
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
        /// Add a prize item to a gacha machine. The machine must be inactive.
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
            // Fail closed: NEP-11 gacha prizes have no deposit path (OnNEP11Payment is
            // unimplemented), so a NEP-11 item always has TokenCount==0 and is silently
            // skipped at draw time, misweighting the odds. Reject NEP-11 until supported.
            ExecutionEngine.Assert(assetType == GA_ASSET_NEP17, "NEP-11 prizes not supported");
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
            // item.AssetHash is user-controlled (machine owner chose it in AddGachaItem).
            // Restrict to AllowCall + AllowNotify per the M-1 / NEW-H-4 audit pattern
            // so a malicious asset cannot re-enter the platform under our witness.
            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.AllowCall | CallFlags.AllowNotify,
                owner, Runtime.ExecutingScriptHash, amount, (ByteString)inventoryMemo);
            Storage.Delete(Storage.CurrentContext, pendingKey);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock += amount;
            StoreGachaItem(appId, machineId, itemIndex, item);
        }

        /// <summary>
        /// Withdraw a machine's accrued pull revenue (GAS) to a recipient. Without this,
        /// the per-pull GAS banked into machine.Revenue was permanently stranded (no path
        /// to collect it). Owner/admin-gated; CEI: revenue is zeroed before the transfer.
        /// </summary>
        public static BigInteger WithdrawGachaRevenue(string appId, BigInteger machineId, UInt160 to)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Gacha);
            ValidateAddress(to);

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            RequireGachaMachineOwnerOrAdmin(appId, machine);

            BigInteger revenue = machine.Revenue;
            ExecutionEngine.Assert(revenue > 0, "no revenue");
            machine.Revenue = 0;
            StoreGachaMachine(appId, machineId, machine);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, revenue),
                "revenue withdrawal failed");
            OnGachaRevenueWithdrawn(appId, machineId, to, revenue);
            return revenue;
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
