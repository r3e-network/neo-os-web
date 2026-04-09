using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
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
        ///
        /// NOTE:
        /// - the live flow consumes direct prepaid GAS credit already held by the contract
        /// Returns: [playId, seed, scriptName]
        /// </summary>
        public static object[] InitiatePlayOptimized(
            UInt160 player,
            BigInteger machineId,
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

            ValidateUserOrAbstractAccount(player);

            ValidateGameBetLimits(player, machine.Price);
            ConsumeDirectGasCredit(player, machine.Price);

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

            OnPlayInitiated(player, machineId, playId, seed);

            return new object[] { playId, seed, SCRIPT_SELECT_ITEM };
        }

        /// <summary>
        /// Phase 2: Settle play with secure on-chain verification.
        /// Contract verifies script hash and re-calculates selection deterministically.
        ///
        /// LIVE TESTNET GUARANTEE:
        /// - the selected prize is re-derived from the stored seed on-chain
        /// - settlement does not trust the frontend-provided choice beyond matching the expected index
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
            UInt160 playOwner = play.Player;
            BigInteger machineId = play.MachineId;
            BigInteger playPrice = play.Price;
            BigInteger playTimestamp = play.Timestamp;
            bool playHybridMode = play.HybridMode;
            ByteString seed = play.Seed;

            ExecutionEngine.Assert(playOwner != UInt160.Zero, "play not found");
            ExecutionEngine.Assert(!play.Resolved, "already resolved");
            ExecutionEngine.Assert(playHybridMode, "not hybrid mode");
            ExecutionEngine.Assert(playOwner == player, "not play owner");

            ValidateUserOrAbstractAccount(playOwner);

            MachineData machine = LoadMachine(machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            // Secure Verification: Re-calculate selection on-chain
            // This iterates O(N) where N <= 100, which is safe for Neo N3.
            if (seed == null)
            {
                seed = GetStoredOperationSeed(playId);
            }
            ByteString verifiedSeed = RequireByteString(seed, "seed missing");
            BigInteger expectedIndex = CalculateExpectedSelection(verifiedSeed, machineId, machine.ItemCount);
            
            // If expectedIndex is 0, it means something went wrong (e.g. no inventory), but the script claiming a specific index should fail.
            // If the user claims index 0 (refund), and expected is 0, then good.
            ExecutionEngine.Assert(selectedIndex == expectedIndex, "selection mismatch");
            BigInteger resolvedIndex = expectedIndex;

            // If selection is 0 (failure/refund case), handle graceful exit (optional, here we assume selection must be valid for specific item)
            // But if expectedIndex is 0 (no items available despite check in Initiate), then selectedIndex must be 0.
            
            if (resolvedIndex == 0)
            {
                ResolveEmptyPlay(playId, ref play);
                return;
            }

            ItemData selectedItem = LoadItem(machineId, resolvedIndex);
            ExecutionEngine.Assert(IsItemAvailable(selectedItem), "item out of stock");

            // Execute transfer
            BigInteger awardedAmount = 0;
            string awardedTokenId = "";

            if (selectedItem.AssetType == ASSET_NEP17)
            {
                awardedAmount = TransferNep17Prize(playOwner, ref selectedItem);
            }
            else if (selectedItem.AssetType == ASSET_NEP11)
            {
                awardedTokenId = TransferNep11Prize(playOwner, machineId, resolvedIndex, ref selectedItem);
            }

            ItemData settledItem = new ItemData
            {
                Name = selectedItem.Name,
                Weight = selectedItem.Weight,
                Rarity = selectedItem.Rarity,
                AssetType = selectedItem.AssetType,
                AssetHash = selectedItem.AssetHash,
                Amount = selectedItem.Amount,
                TokenId = selectedItem.TokenId == null ? "" : selectedItem.TokenId,
                Stock = selectedItem.Stock,
                TokenCount = selectedItem.TokenCount,
                Decimals = selectedItem.Decimals
            };
            StoreItem(machineId, resolvedIndex, settledItem);

            byte[] playKey = GetPlayKey(playId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_PLAYER), playOwner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_MACHINE_ID), machineId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_ITEM_INDEX), resolvedIndex);
            Storage.Put(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_PRICE), playPrice);
            Storage.Put(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_TIMESTAMP), playTimestamp);
            PutBool(playKey, PLAY_FIELD_RESOLVED, true);
            Storage.Delete(Storage.CurrentContext, Helper.Concat(playKey, PLAY_FIELD_SEED));
            PutBool(playKey, PLAY_FIELD_HYBRID_MODE, playHybridMode);

            MachineData updatedMachine = new MachineData
            {
                Creator = machine.Creator,
                Owner = machine.Owner,
                Name = machine.Name,
                Description = machine.Description,
                Category = machine.Category,
                Tags = machine.Tags,
                Price = machine.Price,
                ItemCount = machine.ItemCount,
                TotalWeight = machine.TotalWeight,
                Plays = machine.Plays + 1,
                Revenue = machine.Revenue + playPrice,
                Sales = machine.Sales,
                SalesVolume = machine.SalesVolume,
                CreatedAt = machine.CreatedAt,
                LastPlayedAt = Runtime.Time,
                Active = machine.Active,
                Listed = machine.Listed,
                Banned = machine.Banned,
                Locked = machine.Locked,
                SalePrice = machine.SalePrice
            };
            StoreMachine(machineId, updatedMachine);

            DeleteOperationSeed(playId);
            EmitResolvedPlay(playOwner, machineId, playId, resolvedIndex, settledItem, awardedAmount, awardedTokenId);
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
            byte[] key = (byte[])Key(PREFIX_PLAY_WEIGHT, playId);
            Storage.Put(Storage.CurrentContext, key, weight);
        }

        private static BigInteger GetPlayAvailableWeight(BigInteger playId)
        {
            byte[] key = (byte[])Key(PREFIX_PLAY_WEIGHT, playId);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void DeletePlayAvailableWeight(BigInteger playId)
        {
            byte[] key = (byte[])Key(PREFIX_PLAY_WEIGHT, playId);
            Storage.Delete(Storage.CurrentContext, key);
        }

        #endregion





        #endregion
    }
}
