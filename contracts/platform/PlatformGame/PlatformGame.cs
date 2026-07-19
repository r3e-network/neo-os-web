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
    public delegate void AdminChangedHandler(UInt160 previousAdmin, UInt160 newAdmin);
    public delegate void ContractUpgradedHandler(UInt160 triggeredBy, ByteString nefHash, ByteString manifestHash);
    public delegate void UpgradeScheduledHandler(BigInteger executeAfter);
    public delegate void OracleChangeProposedHandler(UInt160 proposed, BigInteger executeAfter);
    public delegate void OracleChangedHandler(UInt160 previousOracle, UInt160 newOracle);

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
    //  - Self-upgrade:    ScheduleUpdate / Update (timelock + hash pin)
    //  - Oracle repoint:  ProposeOracle / ExecuteOracleChange (timelock;
    //                     the initial SetOracle bind stays instant)
    //  - Per-app admin:   Controls game lifecycle for their own appId
    //  - Users:           Prepay GAS via OnNEP17Payment, then invoke
    //                     game methods with their appId
    //  - Oracle:          Callback authority for CoinFlip / Gacha / Dice RNG
    //
    //  STORAGE LAYOUT:
    //  - 0x01-0x0A: Platform infrastructure (admin, oracle, registry, pause,
    //               AA, upgrade schedule, oracle repoint)
    //  - 0x70-0x71: Direct GAS/asset credit
    //  - 0x80-0x8F: Game registration metadata
    //  - 0xA0-0xAF: Countdown (LastSurvivor) module
    //  - 0xB0-0xBF: CoinFlip (FogPlay) module
    //  - 0xC0-0xDF: Gacha (GASBox) module
    //  - 0xE0-0xEF: Dice module
    //  - 0xF0-0xFF: RewardGame (TEE skill-game) module
    // ===================================================================
    [DisplayName("PlatformGame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant game engine consolidating Countdown, CoinFlip, Gacha, and Dice into one reusable contract.")]
    // Audit fix H-11: wildcard `*:*` permission replaced with explicit allowlist.
    // - NEO native: needed for collateral/voting paths (transfer, vote, balanceOf).
    // - GAS native: needed for settlement / payout / balance pre-check.
    // - Any contract: still allowed for `transfer` and `onNEP17Payment` callbacks so
    //   Gacha can pay out per-app-registered NEP-17/NEP-11 prize assets and oracle
    //   request callbacks can be wired. Method scope is constrained so a malicious
    //   prize asset cannot call arbitrary platform methods back through reentrancy.
    //   `submitMiniAppRequestFromIntegration` reaches the Morpheus session kernel for
    //   RewardGame settlement; `isPaused` is the read-only registry pause consult.
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "vote", "balanceOf", "getAccountState")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer", "balanceOf")]
    [ContractPermission("*", "transfer", "onNEP17Payment", "onNEP11Payment", "requestFromCallback", "getSelectedCandidate", "submitMiniAppRequestFromIntegration", "isPaused")]
    public partial class PlatformGameContract : SmartContract
    {
        // ---------------------------------------------------------------
        //  Game type enum
        // ---------------------------------------------------------------
        public const int GameType_Countdown = 1;
        public const int GameType_CoinFlip  = 2;
        public const int GameType_Gacha     = 3;
        public const int GameType_Dice      = 4;
        public const int GameType_RewardGame = 5;

        // ---------------------------------------------------------------
        //  Platform infrastructure storage prefixes (0x01-0x0A)
        // ---------------------------------------------------------------
        private static readonly byte[] PREFIX_ADMIN             = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_ORACLE            = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_REGISTRY          = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_PAUSED            = new byte[] { 0x04 };
        // Audit fix H2: timelocked, hash-pinned self-upgrade schedule
        // (ported from PlatformRegistry.Governance.cs).
        private static readonly byte[] PREFIX_UPGRADE_TIME      = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_UPGRADE_HASH      = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_ABSTRACT_ACCOUNT  = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_ORACLE_REQUEST    = new byte[] { 0x08 };
        // Audit fix H2: pending oracle repoint (24h timelock).
        private static readonly byte[] PREFIX_PENDING_ORACLE    = new byte[] { 0x09 };
        private static readonly byte[] PREFIX_ORACLE_CHANGE_TIME = new byte[] { 0x0A };
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

        // Timelock for platform admin changes.
        // Runtime.Time is BLOCK TIMESTAMP IN MILLISECONDS on Neo N3, so the
        // delay must be expressed in ms for the comparison `Runtime.Time >= changeTime`
        // to mean "24 hours have passed". Previously stored as seconds (86400)
        // which gave a ~86-second effective timelock.
        private static readonly byte[] PREFIX_PENDING_PLATFORM_ADMIN = new byte[] { 0x86 };
        private static readonly byte[] PREFIX_PLATFORM_ADMIN_CHANGE_TIME = new byte[] { 0x87 };
        private const long TIMELOCK_DELAY_MS = 86400000; // 24 hours in milliseconds

        // ---------------------------------------------------------------
        //  Events
        // ---------------------------------------------------------------
        [DisplayName("GameRegistered")]
        public static event GameRegisteredHandler OnGameRegistered;

        [DisplayName("GamePaused")]
        public static event GamePausedHandler OnGamePaused;

        [DisplayName("AdminTimelockProposed")]
        public static event AdminTimelockProposedHandler OnAdminTimelockProposed;

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged;

        [DisplayName("ContractUpgraded")]
        public static event ContractUpgradedHandler OnContractUpgraded;

        [DisplayName("UpgradeScheduled")]
        public static event UpgradeScheduledHandler OnUpgradeScheduled;

        [DisplayName("OracleChangeProposed")]
        public static event OracleChangeProposedHandler OnOracleChangeProposed;

        [DisplayName("OracleChanged")]
        public static event OracleChangedHandler OnOracleChanged;
    }
}
