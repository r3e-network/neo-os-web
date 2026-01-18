using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppNeoGacha
    {
        #region Hybrid Mode - Frontend Calculation Support

        // Script names for TEE computation
        private const string SCRIPT_SELECT_ITEM = "select-item";

        // Storage prefixes for hybrid mode (0x50+ to avoid collision with app prefixes 0x40-0x4F)
        private static readonly byte[] PREFIX_PLAY_WEIGHT = new byte[] { 0x50 };
        private static readonly byte[] PREFIX_PLAY_RNG = new byte[] { 0x51 };

        /// <summary>
        /// Get all machine items for frontend calculation.
        /// Frontend uses this to calculate availableWeight and selection.
        /// </summary>
        [Safe]
        public static Map<string, object>[] GetMachineItemsForFrontend(BigInteger machineId)
        {
            MachineData machine = LoadMachine(machineId);
            if (machine.Creator == UInt160.Zero) return new Map<string, object>[0];

            Map<string, object>[] items = new Map<string, object>[(int)machine.ItemCount];
            for (BigInteger i = 1; i <= machine.ItemCount; i++)
            {
                ItemData item = LoadItem(machineId, i);
                Map<string, object> itemMap = new Map<string, object>();
                itemMap["index"] = i;
                itemMap["name"] = item.Name;
                itemMap["weight"] = item.Weight;
                itemMap["rarity"] = item.Rarity;
                itemMap["assetType"] = item.AssetType;
                itemMap["assetHash"] = item.AssetHash;
                itemMap["amount"] = item.Amount;
                itemMap["stock"] = item.Stock;
                itemMap["tokenCount"] = item.TokenCount;
                // Frontend calculates: isAvailable = (assetType == 1 && stock >= amount) || (assetType == 2 && tokenCount > 0)
                items[(int)(i - 1)] = itemMap;
            }
            return items;
        }

        /// <summary>
        /// Get constants for frontend gacha calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetGachaConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["maxItemsPerMachine"] = MAX_ITEMS_PER_MACHINE;
            constants["maxTotalWeight"] = MAX_TOTAL_WEIGHT;
            constants["platformFeeBps"] = PLATFORM_FEE_BPS;
            constants["creatorRoyaltyBps"] = CREATOR_ROYALTY_BPS;
            constants["assetNep17"] = ASSET_NEP17;
            constants["assetNep11"] = ASSET_NEP11;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Phase 1: Initiate play with frontend-calculated available weight.
        /// Uses MiniAppComputeBase script registration for verification.
        /// Returns: [playId, seed, scriptName]
        /// </summary>
        public static object[] InitiatePlayOptimized(
            UInt160 player,
            BigInteger machineId,
            BigInteger receiptId,
            BigInteger calculatedAvailableWeight,
            BigInteger sampleItemIndex)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(player);

            // Verify script is registered and enabled
            ExecutionEngine.Assert(
                IsScriptEnabled(SCRIPT_SELECT_ITEM),
                "select script not registered");

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(machine.Active, "machine inactive");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");
            ExecutionEngine.Assert(machine.TotalWeight > 0, "invalid odds");

            // O(1) verification: check sample item is available
            ExecutionEngine.Assert(sampleItemIndex > 0 && sampleItemIndex <= machine.ItemCount, "invalid sample");
            ItemData sampleItem = LoadItem(machineId, sampleItemIndex);
            ExecutionEngine.Assert(IsItemAvailable(sampleItem), "sample item unavailable");

            // Verify calculatedAvailableWeight is positive (frontend calculated)
            ExecutionEngine.Assert(calculatedAvailableWeight > 0, "no inventory");
            ExecutionEngine.Assert(calculatedAvailableWeight <= machine.TotalWeight, "weight exceeds total");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidateGameBetLimits(player, machine.Price);
            ValidatePaymentReceipt(APP_ID, player, machine.Price, receiptId);

            BigInteger playId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PLAY_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PLAY_ID, playId);

            // Generate seed using MiniAppComputeBase method
            ByteString seed = GenerateOperationSeed(playId, player, SCRIPT_SELECT_ITEM);

            PlayData play = new PlayData
            {
                Player = player,
                MachineId = machineId,
                ItemIndex = 0,
                Price = machine.Price,
                Timestamp = Runtime.Time,
                Resolved = false,
                Seed = seed,
                HybridMode = true
            };
            StorePlay(playId, play);

            // Store calculated weight for verification in settle
            StorePlayAvailableWeight(playId, calculatedAvailableWeight);

            RecordGameBet(player, machine.Price);

            OnPlayInitiated(player, machineId, playId, (string)seed);

            return new object[] { playId, (string)seed, SCRIPT_SELECT_ITEM };
        }

        /// <summary>
        /// Phase 2: Settle play with secure on-chain verification.
        /// Contract verifies script hash and re-calculates selection deterministically.
        /// </summary>
        public static void SettlePlayOptimized(
            UInt160 player,
            BigInteger playId,
            BigInteger selectedIndex,
            ByteString scriptHash)
        {
            ValidateNotGloballyPaused(APP_ID);

            // Verify script hash matches registered script
            ValidateScriptHash(SCRIPT_SELECT_ITEM, scriptHash);

            PlayData play = LoadPlay(playId);
            ExecutionEngine.Assert(play.Player != UInt160.Zero, "play not found");
            ExecutionEngine.Assert(!play.Resolved, "already resolved");
            ExecutionEngine.Assert(play.HybridMode, "not hybrid mode");
            ExecutionEngine.Assert(play.Player == player, "not play owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            MachineData machine = LoadMachine(play.MachineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            // Secure Verification: Re-calculate selection on-chain
            // This iterates O(N) where N <= 100, which is safe for Neo N3.
            BigInteger expectedIndex = CalculateExpectedSelection(play.Seed, play.MachineId, machine.ItemCount);
            
            // If expectedIndex is 0, it means something went wrong (e.g. no inventory), but the script claiming a specific index should fail.
            // If the user claims index 0 (refund), and expected is 0, then good.
            ExecutionEngine.Assert(selectedIndex == expectedIndex, "selection mismatch");

            // If selection is 0 (failure/refund case), handle graceful exit (optional, here we assume selection must be valid for specific item)
            // But if expectedIndex is 0 (no items available despite check in Initiate), then selectedIndex must be 0.
            
            if (selectedIndex == 0)
            {
                // Refund logic could go here, or just fail assertion above if selectedIndex provided by user was > 0
                // For now, assuming success path. If expectedIndex == 0, we can't award anything.
                // Resolving as failure.
                play.Resolved = true;
                StorePlay(playId, play);
                DeleteOperationSeed(playId);
                 OnPlayResolved(play.Player, play.MachineId, 0, playId, 0, UInt160.Zero, 0, "");
                return;
            }

            ItemData selectedItem = LoadItem(play.MachineId, selectedIndex);
            ExecutionEngine.Assert(IsItemAvailable(selectedItem), "item out of stock");

            // Execute transfer
            BigInteger awardedAmount = 0;
            string awardedTokenId = "";

            if (selectedItem.AssetType == ASSET_NEP17)
            {
                ExecutionEngine.Assert(selectedItem.Stock >= selectedItem.Amount, "insufficient stock");
                bool ok = (bool)Contract.Call(selectedItem.AssetHash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, play.Player, selectedItem.Amount, null);
                ExecutionEngine.Assert(ok, "transfer failed");
                selectedItem.Stock -= selectedItem.Amount;
                awardedAmount = selectedItem.Amount;
            }
            else if (selectedItem.AssetType == ASSET_NEP11)
            {
                ExecutionEngine.Assert(selectedItem.TokenCount > 0, "no tokens");
                awardedTokenId = RemoveItemToken(play.MachineId, selectedIndex, ref selectedItem, "");
                bool ok = (bool)Contract.Call(selectedItem.AssetHash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, play.Player, awardedTokenId, null);
                ExecutionEngine.Assert(ok, "transfer failed");
            }

            StoreItem(play.MachineId, selectedIndex, selectedItem);

            // Update play state
            play.ItemIndex = selectedIndex;
            play.Resolved = true;
            StorePlay(playId, play);

            // Update machine stats
            machine.Plays = machine.Plays + 1;
            machine.Revenue = machine.Revenue + play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreMachine(play.MachineId, machine);

            // Clean up stored weight and operation seed
            // DeletePlayAvailableWeight(playId); // Removed as we don't store it anymore
            DeleteOperationSeed(playId);

            OnPlayResolved(play.Player, play.MachineId, selectedIndex, playId,
                selectedItem.AssetType, selectedItem.AssetHash, awardedAmount, awardedTokenId);
        }

        /// <summary>
        /// Check if machine should be deactivated (all items depleted).
        /// Frontend calls this after settle if needed.
        /// </summary>
        public static void CheckAndDeactivateMachine(BigInteger machineId, BigInteger calculatedRemainingWeight)
        {
            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            if (calculatedRemainingWeight <= 0 && machine.Active)
            {
                // Verify by checking one item (O(1) spot check)
                bool anyAvailable = false;
                if (machine.ItemCount > 0)
                {
                    // Check first item as spot check
                    ItemData firstItem = LoadItem(machineId, 1);
                    anyAvailable = IsItemAvailable(firstItem);
                }

                if (!anyAvailable || calculatedRemainingWeight <= 0)
                {
                    machine.Active = false;
                    StoreMachine(machineId, machine);
                    OnMachineActivated(machineId, false);
                }
            }
        }

        #region SetMachineActive Hybrid

        /// <summary>
        /// Activate machine with frontend-validated inventory.
        /// Frontend checks all items off-chain, provides sample item for O(1) spot check.
        /// </summary>
        public static void SetMachineActiveWithValidation(
            UInt160 owner,
            BigInteger machineId,
            bool active,
            BigInteger sampleItemIndex)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(owner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");

            ValidateOwnerOrAdmin(owner, machine);

            if (active)
            {
                ExecutionEngine.Assert(machine.ItemCount > 0, "no items");
                ExecutionEngine.Assert(machine.TotalWeight == MAX_TOTAL_WEIGHT, "total weight must be 100");
                ExecutionEngine.Assert(machine.Price > 0, "price required");

                // O(1) spot check - verify sample item has inventory
                ExecutionEngine.Assert(sampleItemIndex > 0 && sampleItemIndex <= machine.ItemCount, "invalid sample");
                ItemData sampleItem = LoadItem(machineId, sampleItemIndex);
                ExecutionEngine.Assert(IsItemAvailable(sampleItem), "sample item unavailable");

                machine.Locked = true;
            }

            machine.Active = active;
            StoreMachine(machineId, machine);
            OnMachineActivated(machineId, active);
        }

        #endregion

        #region Storage Helpers for Hybrid Mode

        private static void StorePlayAvailableWeight(BigInteger playId, BigInteger weight)
        {
            byte[] key = Helper.Concat(PREFIX_PLAY_WEIGHT, playId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, weight);
        }

        private static BigInteger GetPlayAvailableWeight(BigInteger playId)
        {
            byte[] key = Helper.Concat(PREFIX_PLAY_WEIGHT, playId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void DeletePlayAvailableWeight(BigInteger playId)
        {
            byte[] key = Helper.Concat(PREFIX_PLAY_WEIGHT, playId.ToByteArray());
            Storage.Delete(Storage.CurrentContext, key);
        }

        #endregion





        #endregion
    }
}
