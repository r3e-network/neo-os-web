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
    // ===================================================================
    //  Event delegates
    // ===================================================================
    public delegate void GameRegisteredHandler(string appId, BigInteger gameType, UInt160 appAdmin);
    public delegate void GamePausedHandler(string appId, bool paused);
    public delegate void AdminTimelockProposedHandler(UInt160 proposed, BigInteger executeAfter);

    // ===================================================================
    //  PlatformGameContract
    //
    //  Multi-tenant game engine that hosts Countdown (LastSurvivor),
    //  CoinFlip (FogPlay), Gacha (GASBox), and Dice under a single
    //  contract deployment. Every registered miniapp is namespaced by its
    //  appId so storage never collides between tenants.
    //
    //  SECURITY MODEL:
    //  - Platform admin:  ProposeAdmin / ExecuteAdminChange (timelock)
    //  - Per-app admin:   Controls game lifecycle for their own appId
    //  - Users:           Prepay GAS via OnNEP17Payment, then invoke
    //                     game methods with their appId
    //  - Oracle:          Callback authority for CoinFlip / Gacha / Dice RNG
    //
    //  STORAGE LAYOUT:
    //  - 0x01-0x07: Platform infrastructure (admin, oracle, pause, AA)
    //  - 0x70-0x71: Direct GAS/asset credit
    //  - 0x80-0x8F: Game registration metadata
    //  - 0xA0-0xAF: Countdown (LastSurvivor) module
    //  - 0xB0-0xBF: CoinFlip (FogPlay) module
    //  - 0xC0-0xDF: Gacha (GASBox) module
    //  - 0xE0-0xEF: Dice module
    // ===================================================================
    [DisplayName("PlatformGame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant game engine consolidating Countdown, CoinFlip, Gacha, and Dice into one reusable contract.")]
    [ContractPermission("*", "*")]
    public partial class PlatformGameContract : SmartContract
    {
        // ---------------------------------------------------------------
        //  Game type enum
        // ---------------------------------------------------------------
        public const int GameType_Countdown = 1;
        public const int GameType_CoinFlip  = 2;
        public const int GameType_Gacha     = 3;
        public const int GameType_Dice      = 4;

        // ---------------------------------------------------------------
        //  Platform infrastructure storage prefixes (0x01-0x07)
        // ---------------------------------------------------------------
        private static readonly byte[] PREFIX_ADMIN             = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_ORACLE            = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PAUSED            = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_ABSTRACT_ACCOUNT  = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_ORACLE_REQUEST    = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_DIRECT_GAS_CREDIT = new byte[] { 0x70 };

        // ---------------------------------------------------------------
        //  Game registration storage prefixes (0x80-0x8F)
        // ---------------------------------------------------------------
        private static readonly byte[] PREFIX_GAME_TYPE      = new byte[] { 0x80 };
        private static readonly byte[] PREFIX_GAME_ADMIN     = new byte[] { 0x81 };
        private static readonly byte[] PREFIX_GAME_CONFIG    = new byte[] { 0x82 };
        private static readonly byte[] PREFIX_GAME_PAUSED    = new byte[] { 0x83 };
        private static readonly byte[] PREFIX_GAME_ACTIVE    = new byte[] { 0x84 };
        private static readonly byte[] PREFIX_REENTRANCY     = new byte[] { 0x85 };

        // Timelock for platform admin changes
        private static readonly byte[] PREFIX_PENDING_PLATFORM_ADMIN = new byte[] { 0x86 };
        private static readonly byte[] PREFIX_PLATFORM_ADMIN_CHANGE_TIME = new byte[] { 0x87 };
        private const long TIMELOCK_DELAY_SECONDS = 86400; // 24 hours

        // ---------------------------------------------------------------
        //  Events
        // ---------------------------------------------------------------
        [DisplayName("GameRegistered")]
        public static event GameRegisteredHandler OnGameRegistered;

        [DisplayName("GamePaused")]
        public static event GamePausedHandler OnGamePaused;

        [DisplayName("AdminTimelockProposed")]
        public static event AdminTimelockProposedHandler OnAdminTimelockProposed;
    }
}
