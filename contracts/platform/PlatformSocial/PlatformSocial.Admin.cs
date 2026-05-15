using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        // -----------------------------------------------------------------------
        // Lifecycle
        // -----------------------------------------------------------------------
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        // -----------------------------------------------------------------------
        // Admin management
        // -----------------------------------------------------------------------

        [Safe]
        public static UInt160 Admin() => ReadAddress(PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return v != null && (BigInteger)v == 1;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "platform paused");
        }

        private static void ValidateAppNotPaused(string appId)
        {
            ValidateNotPaused();
            ByteString v = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId));
            ExecutionEngine.Assert(v == null || (BigInteger)v == 0, "app paused");
        }

        private static void ValidateAppRegistered(string appId, int expectedType)
        {
            BigInteger appType = GetBigInteger(
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(appType == expectedType, "wrong app type");
        }

        private static void ValidateAppAdmin(string appId)
        {
            UInt160 appAdmin = ReadAppAdmin(appId);
            UInt160 admin = Admin();
            bool isGlobalAdmin = admin != UInt160.Zero && Runtime.CheckWitness(admin);
            bool isAppAdmin = appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin);
            ExecutionEngine.Assert(isGlobalAdmin || isAppAdmin, "not app admin");
        }

        private static UInt160 ReadAppAdmin(string appId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_ADMIN, (ByteString)appId));
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid address");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        // -----------------------------------------------------------------------
        // App registration
        // -----------------------------------------------------------------------

        /// <summary>
        /// Register a social app under a unique appId.
        /// appType: 1=Envelope, 2=Trust, 3=Vault
        /// </summary>
        public static void RegisterApp(string appId, BigInteger appType, UInt160 appAdmin, string config)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appId.Length > 0 && appId.Length <= 64, "invalid appId");
            ExecutionEngine.Assert(appType >= APP_TYPE_ENVELOPE && appType <= APP_TYPE_VAULT, "invalid appType");
            ExecutionEngine.Assert(appAdmin != UInt160.Zero && appAdmin.IsValid, "invalid appAdmin");

            // Ensure not already registered
            BigInteger existing = GetBigInteger(
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
            ExecutionEngine.Assert(existing == 0, "app already registered");

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId), appType);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_ADMIN, (ByteString)appId), appAdmin);
            if (config.Length > 0)
            {
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat((ByteString)PREFIX_APP_CONFIG, (ByteString)appId), config);
            }

            OnAppRegistered(appId, appType, appAdmin);
        }

        /// <summary>
        /// Pause or unpause a specific app.
        /// </summary>
        public static void SetAppPaused(string appId, bool paused)
        {
            ValidateAppAdmin(appId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId),
                paused ? 1 : 0);
            OnAppPaused(appId, paused);
        }

        [Safe]
        public static BigInteger GetAppType(string appId)
        {
            return GetBigInteger(Helper.Concat((ByteString)PREFIX_APP_TYPE, (ByteString)appId));
        }

        [Safe]
        public static bool IsAppPaused(string appId)
        {
            ByteString v = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_APP_PAUSED, (ByteString)appId));
            return v != null && (BigInteger)v == 1;
        }
    }
}
