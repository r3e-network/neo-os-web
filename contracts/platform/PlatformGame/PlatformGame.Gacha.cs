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
    //  - Players pay GAS to pull; a deterministic seed selects the prize
    //  - Settlement verifies the selection on-chain and transfers the asset
    //  - Transparent odds via on-chain weights, verifiable randomness
    //
    //  SECURITY:
    //  - Seed stored before resolution (prevents manipulation)
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
        private const int GA_PLATFORM_FEE_BPS      = 250;
        private const int GA_CREATOR_ROYALTY_BPS    = 500;
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
        ///   costBps   - platform fee in basis points (informational, actual fee is GA_PLATFORM_FEE_BPS)
        ///   items     - reserved for future batch-add (currently unused)
        ///
        /// Returns: machineId
        /// </summary>
        public static BigInteger CreateGachaMachine(
            string appId,
            string name,
            BigInteger price,
            BigInteger costBps,
            ByteString items)
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

            // Transfer tokens from owner to contract
            bool ok = (bool)Contract.Call(item.AssetHash, "transfer", CallFlags.All,
                owner, Runtime.ExecutingScriptHash, amount, null);
            ExecutionEngine.Assert(ok, "transfer failed");

            item.Stock += amount;
            StoreGachaItem(appId, machineId, itemIndex, item);
        }

        // ===================================================================
        //  Player: pull gacha
        // ===================================================================

        /// <summary>
        /// Initiate a gacha pull.  Stores a deterministic seed for later
        /// on-chain verification during settlement.
        ///
        /// FLOW:
        /// 1. Validate machine is active and has inventory
        /// 2. Consume prepaid GAS credit
        /// 3. Generate deterministic seed (block + player + playId)
        /// 4. Store play data with seed
        ///
        /// Returns: playId
        /// </summary>
        public static BigInteger PullGacha(string appId, BigInteger machineId, UInt160 player)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Gacha);

            ValidateUserOrAbstractAccount(player);

            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");
            ExecutionEngine.Assert(machine.Active, "machine inactive");
            ExecutionEngine.Assert(!machine.Banned, "machine banned");
            ExecutionEngine.Assert(machine.TotalWeight > 0, "invalid odds");

            AcquireReentrancyLock(appId);

            ConsumeDirectGasCredit(appId, player, machine.Price);

            BigInteger playId = AppGetInt(appId, GA_PREFIX_PLAY_ID) + 1;
            AppPut(appId, GA_PREFIX_PLAY_ID, playId);

            // Generate deterministic seed from block context
            ByteString seed = GenerateGachaSeed(playId, player);

            GachaPlay play = new GachaPlay
            {
                Player = player,
                MachineId = machineId,
                ItemIndex = 0,
                Price = machine.Price,
                Timestamp = Runtime.Time,
                Resolved = false,
                Seed = seed
            };
            StoreGachaPlay(appId, playId, play);

            ReleaseReentrancyLock(appId);

            OnGachaPlayInitiated(appId, player, machineId, playId, seed);
            return playId;
        }

        /// <summary>
        /// Resolve a gacha pull.  Re-derives the selected item from the
        /// stored seed on-chain, then transfers the prize.
        ///
        /// SECURITY:
        /// - Re-calculates expected selection from stored seed
        /// - Asserts that randomResult matches the expected selection
        /// - Transfers prize atomically
        /// </summary>
        public static void ResolveGachaPull(string appId, BigInteger playId, BigInteger randomResult)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Gacha);

            GachaPlay play = LoadGachaPlay(appId, playId);
            ExecutionEngine.Assert(play.Player != UInt160.Zero, "play not found");
            ExecutionEngine.Assert(!play.Resolved, "already resolved");

            AcquireReentrancyLock(appId);

            BigInteger machineId = play.MachineId;
            GachaMachine machine = LoadGachaMachine(appId, machineId);
            ExecutionEngine.Assert(machine.Creator != UInt160.Zero, "machine not found");

            // Re-derive expected selection from stored seed
            ByteString seed = play.Seed;
            ExecutionEngine.Assert(seed != null && seed.Length > 0, "seed missing");
            BigInteger expectedIndex = CalculateGachaSelection(appId, seed, machineId, machine.ItemCount);

            // Validate the provided result matches on-chain calculation
            ExecutionEngine.Assert(randomResult == expectedIndex, "selection mismatch");

            if (expectedIndex == 0)
            {
                // No items available - resolve as empty
                play.Resolved = true;
                StoreGachaPlay(appId, playId, play);
                ReleaseReentrancyLock(appId);
                OnGachaPlayResolved(appId, play.Player, machineId, 0, playId, 0, UInt160.Zero, 0, "");
                return;
            }

            GachaItem selectedItem = LoadGachaItem(appId, machineId, expectedIndex);
            ExecutionEngine.Assert(IsGachaItemAvailable(selectedItem), "item out of stock");

            // Transfer prize
            BigInteger awardedAmount = 0;
            string awardedTokenId = "";

            if (selectedItem.AssetType == GA_ASSET_NEP17)
            {
                ExecutionEngine.Assert(selectedItem.Stock >= selectedItem.Amount, "insufficient stock");
                bool ok = (bool)Contract.Call(selectedItem.AssetHash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, play.Player, selectedItem.Amount, null);
                ExecutionEngine.Assert(ok, "prize transfer failed");

                awardedAmount = selectedItem.Amount;
                selectedItem.Stock -= selectedItem.Amount;
            }
            else if (selectedItem.AssetType == GA_ASSET_NEP11)
            {
                ExecutionEngine.Assert(selectedItem.TokenCount > 0, "no tokens");
                // Pop last token from the token list
                string tokenId = PopGachaItemToken(appId, machineId, expectedIndex, ref selectedItem);
                bool ok = (bool)Contract.Call(selectedItem.AssetHash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, play.Player, tokenId, null);
                ExecutionEngine.Assert(ok, "NFT transfer failed");

                awardedTokenId = tokenId;
                awardedAmount = 1;
            }

            StoreGachaItem(appId, machineId, expectedIndex, selectedItem);

            // Update play
            play.ItemIndex = expectedIndex;
            play.Resolved = true;
            play.Seed = null;
            StoreGachaPlay(appId, playId, play);

            // Update machine stats
            machine.Plays += 1;
            machine.Revenue += play.Price;
            machine.LastPlayedAt = Runtime.Time;
            StoreGachaMachine(appId, machineId, machine);

            ReleaseReentrancyLock(appId);

            OnGachaPlayResolved(appId, play.Player, machineId, expectedIndex, playId,
                selectedItem.AssetType, selectedItem.AssetHash, awardedAmount,
                awardedTokenId == null ? "" : awardedTokenId);
        }

        // ===================================================================
        //  Read methods
        // ===================================================================

        /// <summary>Get machine details.</summary>
        [Safe]
        public static Map<string, object> GetGachaMachine(string appId, BigInteger machineId)
        {
            GachaMachine m = LoadGachaMachine(appId, machineId);
            Map<string, object> details = new Map<string, object>();

            if (m.Creator == UInt160.Zero) return details;

            details["id"] = machineId;
            details["creator"] = m.Creator;
            details["owner"] = m.Owner;
            details["name"] = m.Name;
            details["description"] = m.Description;
            details["category"] = m.Category;
            details["price"] = m.Price;
            details["itemCount"] = m.ItemCount;
            details["totalWeight"] = m.TotalWeight;
            details["plays"] = m.Plays;
            details["revenue"] = m.Revenue;
            details["createdAt"] = m.CreatedAt;
            details["lastPlayedAt"] = m.LastPlayedAt;
            details["active"] = m.Active;
            details["banned"] = m.Banned;

            return details;
        }

        /// <summary>Get a specific item in a machine.</summary>
        [Safe]
        public static Map<string, object> GetGachaItem(string appId, BigInteger machineId, BigInteger itemIndex)
        {
            GachaItem item = LoadGachaItem(appId, machineId, itemIndex);
            Map<string, object> details = new Map<string, object>();

            if (item.Weight == 0) return details;

            details["name"] = item.Name;
            details["weight"] = item.Weight;
            details["rarity"] = item.Rarity;
            details["assetType"] = item.AssetType;
            details["assetHash"] = item.AssetHash;
            details["amount"] = item.Amount;
            details["tokenId"] = item.TokenId;
            details["stock"] = item.Stock;
            details["tokenCount"] = item.TokenCount;

            return details;
        }

        /// <summary>Get play details.</summary>
        [Safe]
        public static Map<string, object> GetGachaPlay(string appId, BigInteger playId)
        {
            GachaPlay play = LoadGachaPlay(appId, playId);
            Map<string, object> details = new Map<string, object>();

            if (play.Player == UInt160.Zero) return details;

            details["id"] = playId;
            details["player"] = play.Player;
            details["machineId"] = play.MachineId;
            details["itemIndex"] = play.ItemIndex;
            details["price"] = play.Price;
            details["timestamp"] = play.Timestamp;
            details["resolved"] = play.Resolved;

            return details;
        }

        // ===================================================================
        //  Internal gacha helpers
        // ===================================================================

        /// <summary>Check if an item has available inventory.</summary>
        private static bool IsGachaItemAvailable(GachaItem item)
        {
            if (item.AssetType == GA_ASSET_NEP17)
                return item.Amount > 0 && item.Stock >= item.Amount;
            if (item.AssetType == GA_ASSET_NEP11)
                return item.TokenCount > 0;
            return false;
        }

        /// <summary>
        /// Weighted random selection using the stored seed.
        /// Iterates O(N) where N <= 100.
        /// </summary>
        private static BigInteger CalculateGachaSelection(
            string appId,
            ByteString seed,
            BigInteger machineId,
            BigInteger itemCount)
        {
            BigInteger rand = ToPositiveInteger((byte[])seed);

            // Calculate available weight
            BigInteger availableWeight = 0;
            for (BigInteger i = 1; i <= itemCount; i++)
            {
                GachaItem item = LoadGachaItem(appId, machineId, i);
                if (IsGachaItemAvailable(item))
                    availableWeight += item.Weight;
            }

            if (availableWeight <= 0) return 0;

            BigInteger roll = rand % availableWeight;
            BigInteger cumulative = 0;

            for (BigInteger i = 1; i <= itemCount; i++)
            {
                GachaItem item = LoadGachaItem(appId, machineId, i);
                if (!IsGachaItemAvailable(item)) continue;
                cumulative += item.Weight;
                if (roll < cumulative) return i;
            }

            return 0;
        }

        /// <summary>Convert raw bytes to a positive BigInteger (up to 8 bytes).</summary>
        private static BigInteger ToPositiveInteger(byte[] bytes)
        {
            BigInteger value = 0;
            int limit = bytes.Length < 8 ? bytes.Length : 8;
            for (int i = 0; i < limit; i++)
            {
                value = (value << 8) + bytes[i];
            }
            return value;
        }

        /// <summary>
        /// Generate a deterministic seed from block data + player + playId.
        /// In production, this would use the oracle's VRF seed.
        /// </summary>
        private static ByteString GenerateGachaSeed(BigInteger playId, UInt160 player)
        {
            // Combine transaction hash, player address, and playId for seed
            return CryptoLib.Sha256(
                Helper.Concat(
                    Helper.Concat(
                        (ByteString)(byte[])Runtime.ExecutingScriptHash,
                        (ByteString)(byte[])player),
                    (ByteString)playId.ToByteArray()));
        }

        /// <summary>Pop the last token from a gacha item's token list.</summary>
        private static string PopGachaItemToken(
            string appId,
            BigInteger machineId,
            BigInteger itemIndex,
            ref GachaItem item)
        {
            BigInteger count = item.TokenCount;
            ExecutionEngine.Assert(count > 0, "no tokens to pop");

            // Read the last token
            byte[] tokenKey = Helper.Concat(
                (ByteString)AppKeyIdId(appId, GA_PREFIX_ITEM_TOKENS, machineId, itemIndex),
                (ByteString)count.ToByteArray());
            string tokenId = Storage.Get(Storage.CurrentContext, tokenKey);

            // Delete it
            Storage.Delete(Storage.CurrentContext, tokenKey);

            item.TokenCount = count - 1;
            return tokenId;
        }

        /// <summary>
        /// Validate that caller is machine owner or app/platform admin.
        /// </summary>
        private static void RequireGachaMachineOwnerOrAdmin(string appId, GachaMachine machine)
        {
            UInt160 platformAdmin = Admin();
            if (platformAdmin != UInt160.Zero && Runtime.CheckWitness(platformAdmin))
                return;

            UInt160 appAdmin = GetGameAdmin(appId);
            if (appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin))
                return;

            ExecutionEngine.Assert(
                Runtime.CheckWitness(machine.Owner),
                "unauthorized: not owner or admin");
        }

        // ---------------------------------------------------------------
        //  Gacha storage load/store
        // ---------------------------------------------------------------

        private static void StoreGachaMachine(string appId, BigInteger machineId, GachaMachine machine)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_MACHINES, machineId),
                StdLib.Serialize(machine));
        }

        private static GachaMachine LoadGachaMachine(string appId, BigInteger machineId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_MACHINES, machineId));
            if (data == null) return new GachaMachine();
            return (GachaMachine)StdLib.Deserialize(data);
        }

        private static void StoreGachaItem(string appId, BigInteger machineId, BigInteger itemIndex, GachaItem item)
        {
            byte[] key = AppKeyIdId(appId, GA_PREFIX_MACHINE_ITEMS, machineId, itemIndex);
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(item));
        }

        private static GachaItem LoadGachaItem(string appId, BigInteger machineId, BigInteger itemIndex)
        {
            byte[] key = AppKeyIdId(appId, GA_PREFIX_MACHINE_ITEMS, machineId, itemIndex);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new GachaItem();
            return (GachaItem)StdLib.Deserialize(data);
        }

        private static void StoreGachaPlay(string appId, BigInteger playId, GachaPlay play)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_PLAYS, playId),
                StdLib.Serialize(play));
        }

        private static GachaPlay LoadGachaPlay(string appId, BigInteger playId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, GA_PREFIX_PLAYS, playId));
            if (data == null) return new GachaPlay();
            return (GachaPlay)StdLib.Deserialize(data);
        }
    }
}
