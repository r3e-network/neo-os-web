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
        public delegate void GachaPlayRefundedHandler(string appId, UInt160 player, BigInteger machineId, BigInteger playId, BigInteger amount);
        public delegate void GachaMachineActivatedHandler(string appId, BigInteger machineId, bool active);
        public delegate void GachaRevenueWithdrawnHandler(string appId, BigInteger machineId, UInt160 to, BigInteger amount);

        [DisplayName("GachaMachineCreated")]
        public static event GachaMachineCreatedHandler OnGachaMachineCreated;

        [DisplayName("GachaPlayInitiated")]
        public static event GachaPlayInitiatedHandler OnGachaPlayInitiated;

        [DisplayName("GachaPlayResolved")]
        public static event GachaPlayResolvedHandler OnGachaPlayResolved;

        [DisplayName("GachaPlayRefunded")]
        public static event GachaPlayRefundedHandler OnGachaPlayRefunded;

        [DisplayName("GachaMachineActivated")]
        public static event GachaMachineActivatedHandler OnGachaMachineActivated;

        [DisplayName("GachaRevenueWithdrawn")]
        public static event GachaRevenueWithdrawnHandler OnGachaRevenueWithdrawn;

    }
}
