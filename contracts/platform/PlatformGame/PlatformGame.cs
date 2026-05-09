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

        private struct OracleRequestContext
        {
            public string AppId;
            public BigInteger GameType;
            public BigInteger OperationId;
        }

        // ===================================================================
        //  Lifecycle
        // ===================================================================

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        /// <summary>Upgrade the contract. Only the platform admin may call.</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        // ===================================================================
        //  Platform infrastructure: admin, oracle, AA, pause
        //
        //  Self-contained equivalents of MiniAppBase.  This contract does
        //  NOT inherit from MiniAppContract to avoid class conflicts.
        // ===================================================================

        #region Admin / Oracle / AA getters

        /// <summary>Get the platform admin address.</summary>
        [Safe]
        public static UInt160 Admin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the oracle contract address.</summary>
        [Safe]
        public static UInt160 Oracle()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ORACLE);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Get the abstract account contract address.</summary>
        [Safe]
        public static UInt160 AbstractAccount()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>Check whether the entire contract is paused.</summary>
        [Safe]
        public static bool IsContractPaused()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return val != null && (BigInteger)val == 1;
        }

        #endregion

        #region Admin / Oracle / AA setters

        /// <summary>Set the oracle contract address. Admin only.</summary>
        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
        }

        /// <summary>Set the abstract account contract. Admin only.</summary>
        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
        }

        /// <summary>Emergency pause the entire contract. Admin only.</summary>
        public static void SetContractPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        #endregion

        #region Validation helpers

        /// <summary>Assert that the caller is the platform admin.</summary>
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        /// <summary>Assert that the caller is the configured oracle.</summary>
        private static void ValidateOracle()
        {
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == oracle, "only oracle");
        }

        /// <summary>Assert that an address is non-zero and valid.</summary>
        private static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        /// <summary>
        /// Validate that the caller is the user or the abstract account
        /// acting on the user's behalf.
        /// </summary>
        private static void ValidateUserOrAbstractAccount(UInt160 user)
        {
            ValidateAddress(user);

            // Direct witness check
            if (Runtime.CheckWitness(user)) return;

            // Abstract account delegation check
            UInt160 aa = AbstractAccount();
            ExecutionEngine.Assert(
                aa != UInt160.Zero && aa.IsValid && Runtime.CallingScriptHash == aa,
                "unauthorized");
        }

        #endregion

        #region Direct GAS Credit Flow

        /// <summary>Read the payment memo from OnNEP17Payment data.</summary>
        private static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return data.ToString() ?? "";
        }

        /// <summary>
        /// Credit GAS to a payer's balance.
        /// Uses appId-namespaced keys so balances are per-tenant.
        /// </summary>
        private static void CreditDirectGasPayment(string appId, UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash, "unsupported asset");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            // Validate memo format: "appId:..."
            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo.StartsWith(appId + ":"), "invalid payment memo");

            // Store credit under appId + player address
            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, from);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, balance + amount);
        }

        /// <summary>Get a player's prepaid GAS balance for an appId.</summary>
        [Safe]
        public static BigInteger GetDirectGasCredit(string appId, UInt160 payer)
        {
            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>
        /// Consume prepaid GAS credit for a specific appId.
        /// Asserts the payer has sufficient balance.
        /// </summary>
        private static void ConsumeDirectGasCredit(string appId, UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            byte[] key = AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer);
            BigInteger balance = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid gas");

            BigInteger next = balance - amount;
            if (next == 0)
            {
                Storage.Delete(Storage.CurrentContext, key);
            }
            else
            {
                Storage.Put(Storage.CurrentContext, key, next);
            }
        }

        #endregion

        #region Oracle Request Helpers

        /// <summary>
        /// Request RNG or other data from the configured Morpheus Oracle.
        /// </summary>
        private static BigInteger RequestOracleForCallback(
            UInt160 requester, string requestType, ByteString payload)
        {
            ValidateAddress(requester);
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");

            return (BigInteger)Contract.Call(
                oracle,
                "requestFromCallback",
                CallFlags.All,
                requester,
                requestType,
                payload,
                Runtime.ExecutingScriptHash,
                "onOracleResult");
        }

        private static byte[] OracleRequestKey(BigInteger requestId)
        {
            return (byte[])Helper.Concat(
                (ByteString)PREFIX_ORACLE_REQUEST,
                (ByteString)requestId.ToByteArray());
        }

        private static void StoreOracleRequestContext(
            BigInteger requestId,
            string appId,
            BigInteger gameType,
            BigInteger operationId)
        {
            ExecutionEngine.Assert(requestId > 0, "invalid oracle request");
            OracleRequestContext context = new OracleRequestContext
            {
                AppId = appId,
                GameType = gameType,
                OperationId = operationId
            };
            Storage.Put(Storage.CurrentContext, OracleRequestKey(requestId), StdLib.Serialize(new object[]
            {
                context.AppId,
                context.GameType,
                context.OperationId
            }));
        }

        private static OracleRequestContext LoadOracleRequestContext(BigInteger requestId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, OracleRequestKey(requestId));
            ExecutionEngine.Assert(data != null, "oracle request context not found");
            object[] values = (object[])StdLib.Deserialize(data);
            ExecutionEngine.Assert(values != null && values.Length >= 3, "oracle request context malformed");
            return new OracleRequestContext
            {
                AppId = (string)values[0],
                GameType = (BigInteger)values[1],
                OperationId = (BigInteger)values[2]
            };
        }

        /// <summary>
        /// Oracle callback entry point.  Dispatches to the appropriate
        /// game module based on the appId embedded in the payload.
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId,
            string requestType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateOracle();
            OracleRequestContext context = LoadOracleRequestContext(requestId);

            if (!success)
            {
                if (context.GameType == GameType_Dice)
                {
                    RefundDiceBetFromOracle(context.AppId, context.OperationId, requestId);
                }
                Storage.Delete(Storage.CurrentContext, OracleRequestKey(requestId));
                return;
            }
            ExecutionEngine.Assert(requestType == "vrf_random", "unexpected oracle request");
            ExecutionEngine.Assert(result != null && result.Length > 0, "empty oracle result");

            if (context.GameType == GameType_CoinFlip)
            {
                ResolveCoinFlipBetFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else if (context.GameType == GameType_Gacha)
            {
                ResolveGachaPullFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else if (context.GameType == GameType_Dice)
            {
                ResolveDiceBetFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else
            {
                ExecutionEngine.Assert(false, "unsupported oracle game type");
            }

            Storage.Delete(Storage.CurrentContext, OracleRequestKey(requestId));
        }

        #endregion

        // ===================================================================
        //  Platform admin management (with timelock)
        // ===================================================================

        /// <summary>
        /// Propose a new platform admin. The change becomes executable
        /// after TIMELOCK_DELAY_SECONDS.
        /// </summary>
        public static void ProposeAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            ExecutionEngine.Assert(newAdmin != Admin(), "same admin");

            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_SECONDS;
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN, newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME, executeAfter);

            OnAdminTimelockProposed(newAdmin, executeAfter);
        }

        /// <summary>
        /// Execute a pending admin change after the timelock expires.
        /// </summary>
        public static void ExecuteAdminChange()
        {
            ByteString pending = Storage.Get(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            ExecutionEngine.Assert(pending != null, "no pending admin");

            BigInteger changeTime = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
            ExecutionEngine.Assert(Runtime.Time >= changeTime, "timelock active");

            UInt160 newAdmin = (UInt160)pending;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
        }

        /// <summary>
        /// Cancel a pending admin change. Only the current admin may cancel.
        /// </summary>
        public static void CancelAdminChange()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_PLATFORM_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_PLATFORM_ADMIN_CHANGE_TIME);
        }

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
        //  NEP-17 payment receiver
        // ===================================================================

        /// <summary>
        /// Receives GAS/NEO payments.  The data parameter must be a string
        /// in the format "appId:..." so the contract can route the credit
        /// to the correct tenant.
        ///
        /// SECURITY:
        /// - Only accepts GAS or NEO tokens
        /// - Validates that appId extracted from memo is registered
        /// - Credits stored per-payer, consumed by game operations
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || from == UInt160.Zero) return;
            // Self-transfers are internal bookkeeping
            if (from == Runtime.ExecutingScriptHash) return;

            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash,
                "only GAS/NEO accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo != null && memo.Length > 0, "memo required");

            // Extract appId (everything before the first ':')
            string appId = ExtractAppId(memo);
            RequireRegistered(appId);

            if (ConsumePendingGachaInventoryPayment(appId, from, amount, data))
            {
                return;
            }

            // Credit the payer's balance under this appId
            CreditDirectGasPayment(appId, from, amount, data);
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

        // ===================================================================
        //  Internal helpers
        // ===================================================================

        /// <summary>
        /// Assert that the given appId has been registered.
        /// Every mutating method must call this before touching state.
        /// </summary>
        private static void RequireRegistered(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ByteString val = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GAME_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(val != null, "appId not registered");
        }

        /// <summary>Assert that the app is not paused.</summary>
        private static void RequireNotPaused(string appId)
        {
            ExecutionEngine.Assert(!IsPaused(appId), "app paused");
        }

        /// <summary>
        /// Validate that the caller is the app's admin or the platform admin.
        /// </summary>
        private static void RequireAppAdminOrPlatformAdmin(string appId)
        {
            UInt160 platformAdmin = Admin();
            if (platformAdmin != UInt160.Zero && Runtime.CheckWitness(platformAdmin))
                return;

            UInt160 appAdmin = GetGameAdmin(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app or platform admin");
        }

        /// <summary>
        /// Validate that the caller is the specific app's admin.
        /// </summary>
        private static void RequireAppAdmin(string appId)
        {
            UInt160 appAdmin = GetGameAdmin(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app admin");
        }

        /// <summary>
        /// Require that the game type matches expectation.
        /// Prevents calling countdown methods on a CoinFlip app, etc.
        /// </summary>
        private static void RequireGameType(string appId, int expectedType)
        {
            BigInteger actual = GetGameType(appId);
            ExecutionEngine.Assert(actual == expectedType, "wrong game type for appId");
        }

        /// <summary>
        /// Extract appId from a "appId:..." memo string.
        /// </summary>
        private static string ExtractAppId(string memo)
        {
            int colonPos = -1;
            for (int i = 0; i < memo.Length; i++)
            {
                if (memo[i] == ':')
                {
                    colonPos = i;
                    break;
                }
            }
            if (colonPos <= 0) return memo;
            return memo.Substring(0, colonPos);
        }

        /// <summary>
        /// Reentrancy guard: acquire lock for an appId operation.
        /// </summary>
        private static void AcquireReentrancyLock(string appId)
        {
            byte[] key = (byte[])Helper.Concat((ByteString)PREFIX_REENTRANCY, (ByteString)appId);
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(val == null || (BigInteger)val == 0, "reentrancy");
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        /// <summary>
        /// Reentrancy guard: release lock for an appId operation.
        /// </summary>
        private static void ReleaseReentrancyLock(string appId)
        {
            byte[] key = (byte[])Helper.Concat((ByteString)PREFIX_REENTRANCY, (ByteString)appId);
            Storage.Delete(Storage.CurrentContext, key);
        }

        /// <summary>Check if an address is valid and non-zero.</summary>
        private static bool IsValidAddress(UInt160 addr)
        {
            return addr != UInt160.Zero && addr.IsValid;
        }
    }
}
