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
    // ============================================================================
    // MiniApp Contract Template
    // ============================================================================
    // Copy this template for new MiniApp contracts. It includes:
    // - Standard storage prefixes (0x01-0x04 reserved for base functionality)
    // - Admin/Gateway/PaymentHub management
    // - Pause functionality
    // - Update capability
    // - Service callback handler
    //
    // Your app-specific prefixes should start from 0x10
    // ============================================================================

    // Define your app-specific events here
    // public delegate void YourEventHandler(UInt160 user, BigInteger amount);

    [DisplayName("MiniAppTemplate")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "MiniApp Template - Copy and customize")]
    [ContractPermission("*", "*")]
    public class MiniAppTemplate : SmartContract
    {
        #region Standard Storage Prefixes (DO NOT CHANGE)

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PAYMENTHUB = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_PAUSE_REGISTRY = new byte[] { 0x05 };

        #endregion

        #region App Constants
        // Define your app ID here - must match AppRegistry registration
        private const string APP_ID = "builtin-template";
        #endregion

        #region App-Specific Prefixes (start from 0x10)

        // private static readonly byte[] PREFIX_YOUR_DATA = new byte[] { 0x10 };

        #endregion

        #region Standard Getters

        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        public static UInt160 PaymentHub() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAYMENTHUB);
        public static UInt160 PauseRegistry() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY);
        public static bool IsPaused() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) == 1;

        #endregion

        #region Standard Validation

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
            // Check local pause first
            ExecutionEngine.Assert(!IsPaused(), "paused");
            // Check global pause from PauseRegistry
            UInt160 registry = PauseRegistry();
            if (registry != null && registry.IsValid)
            {
                bool globalPaused = (bool)Contract.Call(registry, "isPaused", CallFlags.ReadOnly, new object[] { APP_ID });
                ExecutionEngine.Assert(!globalPaused, "globally paused");
            }
        }

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            // Initialize your app-specific state here
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, null);
        }

        #endregion

        #region Admin Management

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetGateway(UInt160 gw)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gw != null && gw.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gw);
        }

        public static void SetPaymentHub(UInt160 hub)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(hub != null && hub.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENTHUB, hub);
        }

        public static void SetPauseRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(registry != null && registry.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY, registry);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        #endregion

        #region Service Callback

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();
            // Handle service callbacks here
        }

        #endregion

        #region App-Specific Methods

        // Add your app-specific methods here

        #endregion
    }
}
