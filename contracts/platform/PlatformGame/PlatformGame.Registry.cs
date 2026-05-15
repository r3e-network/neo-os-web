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
    public partial class PlatformGameContract
    {
        // ===================================================================
        //  Game registration
        // ===================================================================

        /// <summary>
        /// Register a new miniapp game. Only the platform admin may call.
        ///
        /// Parameters:
        ///   appId    - unique string identifier for the tenant
        ///   gameType - GameType_Countdown(1), GameType_CoinFlip(2), GameType_Gacha(3), GameType_Dice(4)
        ///   appAdmin - address that controls this app's lifecycle
        ///   config   - serialized configuration blob (game-specific)
        /// </summary>
        public static void RegisterGame(string appId, BigInteger gameType, UInt160 appAdmin, ByteString config)
        {
            ValidateAdmin();
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ExecutionEngine.Assert(appId.Length <= 64, "appId too long");
            ExecutionEngine.Assert(
                gameType == GameType_Countdown ||
                gameType == GameType_CoinFlip ||
                gameType == GameType_Gacha ||
                gameType == GameType_Dice,
                "invalid game type");

            // Ensure not already registered
            ByteString existingType = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(existingType == null, "appId already registered");

            // Store game metadata
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId),
                gameType);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_ADMIN, (ByteString)appId),
                appAdmin);
            if (config != null && config.Length > 0)
            {
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_GAME_CONFIG, (ByteString)appId),
                    config);
            }

            // Mark active by default
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_ACTIVE, (ByteString)appId), 1);

            OnGameRegistered(appId, gameType, appAdmin);
        }

        // ===================================================================
        //  Per-app pause management
        // ===================================================================

        /// <summary>Check whether a specific app is paused.</summary>
        [Safe]
        public static bool IsPaused(string appId)
        {
            // Contract-level pause overrides everything
            if (IsContractPaused()) return true;
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_PAUSED, (ByteString)appId));
            return val != null && (BigInteger)val == 1;
        }

        /// <summary>
        /// Pause or unpause a specific app.
        /// Callable by the platform admin or the app's own admin.
        /// </summary>
        public static void SetPaused(string appId, bool paused)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId);

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_PAUSED, (ByteString)appId),
                paused ? 1 : 0);

            OnGamePaused(appId, paused);
        }

        // ===================================================================
        //  Read methods
        // ===================================================================

        /// <summary>Get the GameType for a registered app.</summary>
        [Safe]
        public static BigInteger GetGameType(string appId)
        {
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId));
            return val == null ? 0 : (BigInteger)val;
        }

        /// <summary>Check whether an app is registered and active.</summary>
        [Safe]
        public static bool IsGameActive(string appId)
        {
            BigInteger gameType = GetGameType(appId);
            if (gameType == 0) return false;
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_ACTIVE, (ByteString)appId));
            return val != null && (BigInteger)val == 1;
        }

        /// <summary>Get the admin address for a specific app.</summary>
        [Safe]
        public static UInt160 GetGameAdmin(string appId)
        {
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_ADMIN, (ByteString)appId));
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the stored config blob for an app.</summary>
        [Safe]
        public static ByteString GetGameConfig(string appId)
        {
            return Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_CONFIG, (ByteString)appId));
        }
    }
}
