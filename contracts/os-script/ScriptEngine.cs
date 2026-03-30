using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    // Event delegates with named parameters
    public delegate void ScriptRegisteredHandler(string appId, string hookPoint, UInt160 scriptHash);
    public delegate void ScriptUnregisteredHandler(string appId, string hookPoint);
    public delegate void ScriptExecutedHandler(string appId, string hookPoint, bool success);
    public delegate void ScriptDisabledHandler(string appId, string hookPoint);
    public delegate void GlobalScriptPauseHandler(bool paused);
    public delegate void ScriptAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    /// <summary>
    /// ScriptEngine -- on-chain NeoVM bytecode execution at hook points.
    ///
    /// The Dalvik/ART VM equivalent for MiniApp-OS v2. Lets miniapps register
    /// pre-deployed contracts as handlers for OS-level hook points. OS services
    /// (PaymentService, GameService, etc.) call Execute at defined hook points
    /// to run app-specific behaviour without each app deploying a full contract.
    ///
    /// Registered scripts must be pre-deployed contracts exposing:
    ///   Execute(string appId, string hookPoint, ByteString contextData)
    ///
    /// Supported hook points (by convention):
    ///   - onPaymentReceived   -- triggered after a payment is routed to the app
    ///   - onSettlement        -- triggered when a settlement cycle completes
    ///   - onCheckin           -- triggered after a daily check-in is recorded
    ///   - onBadgeAwarded      -- triggered when a badge/achievement is granted
    ///   - onEscrowStateChange -- triggered on escrow state transitions
    ///   - onCustom:&lt;name&gt;     -- app-defined custom hook (prefix "onCustom:")
    /// </summary>
    [DisplayName("ScriptEngine")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS ScriptEngine -- on-chain NeoVM bytecode execution at hook points")]
    [ContractPermission("*", "*")]
    public class ScriptEngine : SmartContract
    {
        // ----------------------------------------------------------------
        // Storage prefixes
        // ----------------------------------------------------------------
        private static readonly byte[] PREFIX_ADMIN              = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY       = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_SCRIPT             = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GAS_LIMIT          = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_EXEC_COUNT         = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_DISABLED           = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_GLOBAL_PAUSE       = new byte[] { 0x50 };
        private static readonly byte[] PREFIX_WHITELISTED_CALLER = new byte[] { 0x60 };

        // ----------------------------------------------------------------
        // Constants
        // ----------------------------------------------------------------
        private const long DEFAULT_GAS_LIMIT = 5_00000000;   // 5 GAS
        private const long MAX_GAS_LIMIT     = 50_00000000;  // 50 GAS
        private const int  MAX_HOOK_NAME_LENGTH = 64;

        // ----------------------------------------------------------------
        // Events
        // ----------------------------------------------------------------
        [DisplayName("ScriptRegistered")]
        public static event ScriptRegisteredHandler OnScriptRegistered = delegate { };

        [DisplayName("ScriptUnregistered")]
        public static event ScriptUnregisteredHandler OnScriptUnregistered = delegate { };

        [DisplayName("ScriptExecuted")]
        public static event ScriptExecutedHandler OnScriptExecuted = delegate { };

        [DisplayName("ScriptDisabled")]
        public static event ScriptDisabledHandler OnScriptDisabled = delegate { };

        [DisplayName("GlobalScriptPause")]
        public static event GlobalScriptPauseHandler OnGlobalScriptPause = delegate { };

        [DisplayName("AdminChanged")]
        public static event ScriptAdminChangedHandler OnAdminChanged = delegate { };

        // ----------------------------------------------------------------
        // Lifecycle
        // ----------------------------------------------------------------
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ----------------------------------------------------------------
        // Admin helpers
        // ----------------------------------------------------------------
        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        // ----------------------------------------------------------------
        // App Registry reference (for developer auth)
        // ----------------------------------------------------------------
        public static void SetAppRegistry(UInt160 registryHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(registryHash != UInt160.Zero && registryHash.IsValid, "invalid registry hash");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, (ByteString)registryHash);
        }

        [Safe]
        public static UInt160 GetAppRegistry()
        {
            return ReadAddress(PREFIX_APP_REGISTRY);
        }

        // ----------------------------------------------------------------
        // Whitelisted callers (OS services allowed to call Execute)
        // ----------------------------------------------------------------
        private static StorageMap WhitelistedCallerMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_WHITELISTED_CALLER);

        public static void WhitelistCaller(UInt160 osServiceHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(osServiceHash != UInt160.Zero && osServiceHash.IsValid, "invalid service hash");
            WhitelistedCallerMap().Put((ByteString)osServiceHash, 1);
        }

        public static void RemoveWhitelistedCaller(UInt160 osServiceHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(osServiceHash != UInt160.Zero && osServiceHash.IsValid, "invalid service hash");
            WhitelistedCallerMap().Delete((ByteString)osServiceHash);
        }

        [Safe]
        public static bool IsWhitelistedCaller(UInt160 callerHash)
        {
            ByteString? val = WhitelistedCallerMap().Get((ByteString)callerHash);
            return val != null;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value == 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, value);
        }

        // ----------------------------------------------------------------
        // Storage maps and key helpers
        // ----------------------------------------------------------------
        private static StorageMap ScriptMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT);

        private static StorageMap GasLimitMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_GAS_LIMIT);

        private static StorageMap ExecCountMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_EXEC_COUNT);

        private static StorageMap DisabledMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_DISABLED);

        private static ByteString HookKey(string appId, string hookPoint)
        {
            return Helper.Concat((ByteString)appId, (ByteString)(":" + hookPoint));
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
        }

        private static void ValidateHookPoint(string hookPoint)
        {
            ExecutionEngine.Assert(hookPoint != null && hookPoint.Length > 0, "hook point required");
            ExecutionEngine.Assert(hookPoint!.Length <= MAX_HOOK_NAME_LENGTH, "hook name too long");
        }

        /// <summary>
        /// Validates that the caller is the developer of the given app by
        /// calling AppRegistry.GetApp and checking witness against the developer address.
        /// </summary>
        private static void ValidateDeveloper(string appId)
        {
            UInt160 registry = GetAppRegistry();
            ExecutionEngine.Assert(registry != UInt160.Zero, "app registry not set");

            // Call AppRegistry.GetApp(appId) -- returns an AppInfo struct.
            // The developer field (index 1 in the serialized struct) is a UInt160.
            object[] appInfo = (object[])Contract.Call(registry, "getApp", CallFlags.ReadOnly, new object[] { appId });
            // AppInfo struct: [0]=AppId, [1]=Developer, ...
            UInt160 developer = (UInt160)appInfo[1];
            ExecutionEngine.Assert(developer != UInt160.Zero, "app not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(developer), "unauthorized: not app developer");
        }

        // ----------------------------------------------------------------
        // Script registration
        // ----------------------------------------------------------------

        /// <summary>
        /// Register a pre-deployed contract as handler for a hook point.
        /// Only the app developer (validated via AppRegistry) can register.
        /// The target contract must already be deployed (verified via ContractManagement).
        /// </summary>
        public static void RegisterScript(string appId, string hookPoint, UInt160 scriptContractHash)
        {
            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);
            ExecutionEngine.Assert(scriptContractHash != UInt160.Zero && scriptContractHash.IsValid, "invalid script hash");

            // Verify the script contract exists on chain
            ExecutionEngine.Assert(ContractManagement.GetContract(scriptContractHash) != null, "script contract not deployed");

            ValidateDeveloper(appId);

            ByteString key = HookKey(appId, hookPoint);
            ScriptMap().Put(key, (ByteString)scriptContractHash);
            OnScriptRegistered(appId, hookPoint, scriptContractHash);
        }

        /// <summary>
        /// Unregister a script from a hook point.  Only the app developer can remove.
        /// </summary>
        public static void UnregisterScript(string appId, string hookPoint)
        {
            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);
            ValidateDeveloper(appId);

            ByteString key = HookKey(appId, hookPoint);
            ScriptMap().Delete(key);
            // Also clean up the gas limit and disabled flag
            GasLimitMap().Delete(key);
            DisabledMap().Delete(key);
            OnScriptUnregistered(appId, hookPoint);
        }

        // ----------------------------------------------------------------
        // Gas limit configuration
        // ----------------------------------------------------------------

        /// <summary>
        /// Set a custom gas limit for a hook point execution.
        /// Only the app developer can configure.
        /// </summary>
        public static void SetGasLimit(string appId, string hookPoint, BigInteger maxGas)
        {
            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);
            ExecutionEngine.Assert(maxGas > 0, "gas limit must be positive");
            ExecutionEngine.Assert(maxGas <= MAX_GAS_LIMIT, "exceeds max gas limit");
            ValidateDeveloper(appId);

            ByteString key = HookKey(appId, hookPoint);
            GasLimitMap().Put(key, maxGas);
        }

        // ----------------------------------------------------------------
        // Core execution
        // ----------------------------------------------------------------

        /// <summary>
        /// Execute a registered script at a hook point.
        ///
        /// Only whitelisted OS service contracts or the admin may call this method.
        /// Script failures are caught -- they never block the calling OS service.
        /// Returns null if no script is registered (this is not an error).
        /// </summary>
        public static object? Execute(string appId, string hookPoint, ByteString contextData)
        {
            // Caller authorization: must be whitelisted OS service or admin
            UInt160 caller = Runtime.CallingScriptHash;
            UInt160 admin = GetAdmin();
            bool isAdmin = admin != UInt160.Zero && caller == admin;
            bool isWhitelisted = IsWhitelistedCaller(caller);
            ExecutionEngine.Assert(isAdmin || isWhitelisted, "caller not authorized");

            // Global pause check
            ByteString? pauseVal = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSE);
            if (pauseVal != null && (BigInteger)pauseVal != 0)
            {
                return null;
            }

            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);

            ByteString key = HookKey(appId, hookPoint);

            // Per-script disable check
            ByteString? disabledVal = DisabledMap().Get(key);
            if (disabledVal != null && (BigInteger)disabledVal != 0)
            {
                return null;
            }

            // Look up registered script
            ByteString? scriptRaw = ScriptMap().Get(key);
            if (scriptRaw == null)
            {
                // No script registered -- not an error
                return null;
            }
            UInt160 scriptHash = (UInt160)scriptRaw;

            // Execute the script contract with try/catch -- failures must never block
            bool success = true;
            object? result = null;
            try
            {
                result = Contract.Call(scriptHash, "execute", CallFlags.All,
                    new object[] { appId, hookPoint, contextData });
            }
            catch (Exception)
            {
                success = false;
            }

            // Increment execution counter
            ByteString? countRaw = ExecCountMap().Get(key);
            BigInteger count = countRaw == null ? 0 : (BigInteger)countRaw;
            ExecCountMap().Put(key, count + 1);

            OnScriptExecuted(appId, hookPoint, success);
            return result;
        }

        // ----------------------------------------------------------------
        // Read-only queries
        // ----------------------------------------------------------------

        /// <summary>
        /// Get the registered script contract hash for a hook point.
        /// Returns UInt160.Zero if no script is registered.
        /// </summary>
        [Safe]
        public static UInt160 GetScript(string appId, string hookPoint)
        {
            ByteString? raw = ScriptMap().Get(HookKey(appId, hookPoint));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        /// <summary>
        /// Get the gas limit for a hook point.  Returns DEFAULT_GAS_LIMIT if not set.
        /// </summary>
        [Safe]
        public static BigInteger GetGasLimit(string appId, string hookPoint)
        {
            ByteString? raw = GasLimitMap().Get(HookKey(appId, hookPoint));
            return raw == null ? DEFAULT_GAS_LIMIT : (BigInteger)raw;
        }

        /// <summary>
        /// Get the total execution count for a hook point.
        /// </summary>
        [Safe]
        public static BigInteger GetExecutionCount(string appId, string hookPoint)
        {
            ByteString? raw = ExecCountMap().Get(HookKey(appId, hookPoint));
            return raw == null ? 0 : (BigInteger)raw;
        }

        /// <summary>
        /// Check whether a script is disabled (emergency disable by admin).
        /// </summary>
        [Safe]
        public static bool IsScriptDisabled(string appId, string hookPoint)
        {
            ByteString? raw = DisabledMap().Get(HookKey(appId, hookPoint));
            return raw != null && (BigInteger)raw != 0;
        }

        // ----------------------------------------------------------------
        // Admin emergency controls
        // ----------------------------------------------------------------

        /// <summary>
        /// Emergency disable a specific script.  Admin only.
        /// </summary>
        public static void DisableScript(string appId, string hookPoint)
        {
            ValidateAdmin();
            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);
            DisabledMap().Put(HookKey(appId, hookPoint), 1);
            OnScriptDisabled(appId, hookPoint);
        }

        /// <summary>
        /// Re-enable a previously disabled script.  Admin only.
        /// </summary>
        public static void EnableScript(string appId, string hookPoint)
        {
            ValidateAdmin();
            ValidateAppId(appId);
            ValidateHookPoint(hookPoint);
            DisabledMap().Delete(HookKey(appId, hookPoint));
        }

        /// <summary>
        /// Global pause / unpause all script execution.  Admin only.
        /// </summary>
        public static void SetGlobalScriptPause(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_GLOBAL_PAUSE, paused ? 1 : 0);
            OnGlobalScriptPause(paused);
        }
    }
}
