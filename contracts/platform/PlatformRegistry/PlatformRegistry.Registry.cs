using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — app registration (design section 3.1)
    //
    //  registerApp is PERMISSIONLESS: any app admin with prepaid GAS
    //  credit under (appId, appAdmin) self-registers — the PlatformAnchor
    //  M-11 model, the only registration path that ever attracted
    //  self-service tenants. registerAppByPlatform is the ops pipeline
    //  lane. Lite tier = a registration without an account mint; the
    //  full tier composes registerApp + mintAccount.
    // ===================================================================
    public partial class PlatformRegistry
    {
        /// <summary>
        /// Permissionless registration. Fee: 1 GAS consumed from the app
        /// admin's prepaid (appId, appAdmin) credit (anti-spam, M-11).
        /// An empty engineId registers a directory-only (lite) row.
        /// </summary>
        public static void RegisterApp(string appId, string engineId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            RequireNotGloballyPaused();
            ValidateAppIdFormat(appId);
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(Runtime.CheckWitness(appAdmin), "app admin witness required");
            ConsumeCredit(appId, appAdmin, FEE_LITE_REGISTRATION);
            AccrueFees(FEE_LITE_REGISTRATION);
            RegisterAppCore(appId, engineId, appAdmin, descriptor);
        }

        /// <summary>Pipeline lane: platform-admin registration, fee-exempt.</summary>
        public static void RegisterAppByPlatform(string appId, string engineId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            RequireNotGloballyPaused();
            ValidateAdmin();
            ValidateAppIdFormat(appId);
            ValidateAddress(appAdmin);
            RegisterAppCore(appId, engineId, appAdmin, descriptor);
        }

        /// <summary>
        /// Attach (or re-attach) an engine to a registered app. App-admin
        /// witnessed: engine attachment is the app's own power (trust table).
        /// Re-attachment to a NEW engine row is the opt-in path for engine
        /// schema upgrades; the push into the engine repeats on every attach.
        /// </summary>
        public static void AttachEngine(string appId, string engineId)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            RequireAppNotPaused(appId);
            RequireAppAdmin(appId);
            ExecutionEngine.Assert(engineId != null && engineId.Length > 0, "engineId required");
            ExecutionEngine.Assert(EngineIdOf(appId) != engineId, "engine already attached");
            AttachEngineCore(appId, engineId, AppAdminOf(appId), null);
        }

        private static void RegisterAppCore(string appId, string engineId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId)) == null,
                "appId already registered");
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId), appAdmin);
            // Default payout destination is the app admin (role-bound); any
            // change goes through the 24h payout timelock in the treasury.
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PAYOUT, appId), appAdmin);
            if (engineId != null && engineId.Length > 0)
            {
                AttachEngineCore(appId, engineId, appAdmin, descriptor);
            }
            else
            {
                ExecutionEngine.Assert(
                    descriptor == null || descriptor.Keys.Length == 0,
                    "descriptor requires an engine");
            }
            OnAppRegistered(appId, engineId == null ? "" : engineId, appAdmin, UInt160.Zero);
        }

        // Resolves the engine row, records the attachment, persists namespaced
        // descriptor entries, and PUSHES the tenant into the engine so engines
        // never pay a cross-contract registry read per gameplay call.
        private static void AttachEngineCore(string appId, string engineId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            EngineRow row = GetEngineRow(engineId);
            ExecutionEngine.Assert(row != null && row.Active, "engine not active");
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ENGINE, appId), engineId);
            if (descriptor != null)
            {
                string[] keys = descriptor.Keys;
                for (int i = 0; i < keys.Length; i++)
                {
                    ExecutionEngine.Assert(KeyInNamespace(keys[i], engineId), "descriptor key outside engine namespace");
                    StoreDescriptor(appId, keys[i], descriptor[keys[i]]);
                }
            }
            Contract.Call(row.Hash, "activateApp", CallFlags.All, appId, appAdmin, descriptor);
            OnEngineAttached(appId, engineId);
        }
    }
}
