using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates
    public delegate void AppRegisteredInUniversalHandler(string appId, UInt160 owner);
    public delegate void AppUnregisteredHandler(string appId);
    public delegate void ValueSetHandler(string appId, string key);
    public delegate void ValueDeletedHandler(string appId, string key);

    [DisplayName("UniversalMiniApp")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Universal MiniApp contract - no custom contract deployment needed")]
    [ContractPermission("*", "*")]
    public partial class UniversalMiniApp : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_PAYMENT_HUB = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x05 };
        // App registration: 0x10
        private static readonly byte[] PREFIX_APP_OWNER = new byte[] { 0x10 };
        // App admin: 0x11 (separate from owner for delegation)
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x11 };
        // App storage: 0x20
        private static readonly byte[] PREFIX_APP_DATA = new byte[] { 0x20 };

        #endregion

        #region Events

        [DisplayName("AppRegisteredInUniversal")]
        public static event AppRegisteredInUniversalHandler OnAppRegistered;

        [DisplayName("AppUnregistered")]
        public static event AppUnregisteredHandler OnAppUnregistered;

        [DisplayName("ValueSet")]
        public static event ValueSetHandler OnValueSet;

        [DisplayName("ValueDeleted")]
        public static event ValueDeletedHandler OnValueDeleted;

        #endregion

        #region Deployment

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        #endregion

        #region Standard Getters

        [Safe]
        public static UInt160 Admin() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        [Safe]
        public static UInt160 Gateway() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        [Safe]
        public static UInt160 AppRegistry() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_APP_REGISTRY);

        [Safe]
        public static UInt160 PaymentHub() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAYMENT_HUB);

        [Safe]
        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) == 1;

        #endregion

        #region Validation

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateGateway()
        {
            UInt160 gw = Gateway();
            ExecutionEngine.Assert(gw != null && gw.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gw, "only gateway");
        }

        private static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "contract paused");
        }

        private static void ValidateAppId(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(appId.Length <= 64, "app id too long");
            ExecutionEngine.Assert(appId.IndexOf(":") < 0, "invalid app id: colon not allowed");
            ExecutionEngine.Assert(appId.IndexOf("/") < 0, "invalid app id: slash not allowed");
        }

        #endregion

        #region Admin Management

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetGateway(UInt160 gw)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gw != null && gw.IsValid, "invalid gateway");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gw);
        }

        public static void SetAppRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(registry != null && registry.IsValid, "invalid registry");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, registry);
        }

        public static void SetPaymentHub(UInt160 hub)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(hub != null && hub.IsValid, "invalid hub");
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENT_HUB, hub);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, null);
        }

        #endregion

        #region App Registration

        private static StorageMap AppOwnerMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_APP_OWNER);

        private static StorageMap AppAdminMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_APP_ADMIN);

        [Safe]
        public static UInt160 GetAppOwner(string appId)
        {
            ValidateAppId(appId);
            return (UInt160)AppOwnerMap().Get(appId);
        }

        [Safe]
        public static UInt160 GetAppAdmin(string appId)
        {
            ValidateAppId(appId);
            return (UInt160)AppAdminMap().Get(appId);
        }

        [Safe]
        public static bool IsAppRegistered(string appId)
        {
            ValidateAppId(appId);
            return AppOwnerMap().Get(appId) != null;
        }

        private static void ValidateAppOwner(string appId)
        {
            UInt160 owner = GetAppOwner(appId);
            ExecutionEngine.Assert(owner != null, "app not registered");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "not app owner");
        }

        private static void ValidateAppAdmin(string appId)
        {
            UInt160 admin = GetAppAdmin(appId);
            ExecutionEngine.Assert(admin != null, "app admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "not app admin");
        }

        /// <summary>
        /// Register a new app. Caller becomes owner and admin.
        /// </summary>
        public static void RegisterApp(string appId)
        {
            ValidateNotPaused();
            ValidateAppId(appId);
            ExecutionEngine.Assert(!IsAppRegistered(appId), "already registered");

            Transaction tx = Runtime.Transaction;
            AppOwnerMap().Put(appId, tx.Sender);
            AppAdminMap().Put(appId, tx.Sender);
            OnAppRegistered(appId, tx.Sender);
        }

        /// <summary>
        /// Unregister an app. Only owner can unregister.
        /// Note: App data in PREFIX_APP_DATA is NOT deleted for audit purposes.
        /// Use ClearAppData() before unregistering if data cleanup is needed.
        /// </summary>
        public static void UnregisterApp(string appId)
        {
            ValidateNotPaused();
            ValidateAppOwner(appId);

            AppOwnerMap().Delete(appId);
            AppAdminMap().Delete(appId);
            OnAppUnregistered(appId);
        }

        /// <summary>
        /// Transfer app ownership to a new address. Only current owner can transfer.
        /// </summary>
        public static void TransferOwnership(string appId, UInt160 newOwner)
        {
            ValidateNotPaused();
            ValidateAppOwner(appId);
            ExecutionEngine.Assert(newOwner != null && newOwner.IsValid, "invalid new owner");

            AppOwnerMap().Put(appId, newOwner);
        }

        /// <summary>
        /// Set app admin. Only owner can change admin.
        /// </summary>
        public static void SetAppAdmin(string appId, UInt160 newAdmin)
        {
            ValidateNotPaused();
            ValidateAppOwner(appId);
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");

            AppAdminMap().Put(appId, newAdmin);
        }

        #endregion
    }
}
