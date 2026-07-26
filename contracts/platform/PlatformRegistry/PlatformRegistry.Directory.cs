using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — directory reads + shared internals
    //
    //  The canonical estate ledger (design section 3.1): appId -> account,
    //  account -> appId, engine attachment, pause state — closing the
    //  census gap "no on-chain appId -> address registry exists".
    // ===================================================================
    public partial class PlatformRegistry
    {
        // ---- [Safe] directory reads ----

        [Safe]
        public static UInt160 Admin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        /// <summary>App row as [engineId, engineHash, appAdmin, accountHash,
        /// materialized, active].</summary>
        [Safe]
        public static object[] GetApp(string appId)
        {
            UInt160 appAdmin = AppAdminOf(appId);
            ExecutionEngine.Assert(appAdmin != UInt160.Zero, "appId not registered");
            string engineId = EngineIdOf(appId);
            UInt160 engineHash = UInt160.Zero;
            if (engineId.Length > 0)
            {
                EngineRow row = GetEngineRow(engineId);
                if (row != null) engineHash = row.Hash;
            }
            UInt160 account = AccountOf(appId);
            bool materialized = account != UInt160.Zero;
            bool active = !IsPaused(appId);
            return new object[] { engineId, engineHash, appAdmin, account, materialized, active };
        }

        [Safe]
        public static UInt160 AppAccountOf(string appId) => AccountOf(appId);

        /// <summary>The permission-anchoring reverse index.</summary>
        [Safe]
        public static string AppIdOfAccount(UInt160 account)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AccountKey(PREFIX_APP_ID_BY_ACCOUNT, account));
            return raw == null ? "" : (string)raw;
        }

        [Safe]
        public static string EngineOf(string appId) => EngineIdOf(appId);

        [Safe]
        public static UInt160 AppAdminOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        /// <summary>Per-app pause read (global pause overrides), consulted by
        /// engines and lane-B shims.</summary>
        [Safe]
        public static bool IsPaused(string appId)
        {
            if (Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT) != null) return true;
            return Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_PAUSED, appId)) != null;
        }

        /// <summary>The pause read the AppAccount escape hatch pins:
        /// [paused, pausedAt].</summary>
        [Safe]
        public static object[] GetGlobalPause()
        {
            ByteString rawAt = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT);
            bool paused = rawAt != null;
            BigInteger pausedAt = rawAt == null ? 0 : (BigInteger)rawAt;
            return new object[] { paused, pausedAt };
        }

        [Safe]
        public static BigInteger ArtifactVersion()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_VERSION);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger ArtifactChecksum()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ARTIFACT_CHECKSUM);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static bool ShimUpgradeConsentOf(string appId) =>
            Storage.Get(Storage.CurrentContext, AppKey(PREFIX_SHIM_CONSENT, appId)) != null;

        // ---- shared internals ----

        private static UInt160 AccountOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ACCOUNT, appId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        private static string EngineIdOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ENGINE, appId));
            return raw == null ? "" : (string)raw;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsPlatformAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && Runtime.CheckWitness(admin);
        }

        private static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != null && addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        // appIds are manifest-name material (the mint splices them into the
        // account manifest JSON), so the charset is locked to JSON-safe
        // lowercase identifier characters.
        private static void ValidateAppIdFormat(string appId)
        {
            ExecutionEngine.Assert(
                appId != null && appId.Length > 0 && appId.Length <= MAX_APP_ID_LENGTH,
                "invalid appId");
            for (int i = 0; i < appId.Length; i++)
            {
                char c = appId[i];
                bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.';
                ExecutionEngine.Assert(ok, "invalid appId");
            }
        }

        private static void ValidatePermissionlessAppId(string appId)
        {
            ExecutionEngine.Assert(!appId.StartsWith(PLATFORM_APP_ID_PREFIX), "appId reserved for platform registration");
        }

        private static void ValidateEngineIdFormat(string engineId)
        {
            ExecutionEngine.Assert(
                engineId != null && engineId.Length > 0 && engineId.Length <= MAX_APP_ID_LENGTH,
                "invalid engineId");
            for (int i = 0; i < engineId.Length; i++)
            {
                char c = engineId[i];
                bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.';
                ExecutionEngine.Assert(ok, "invalid engineId");
            }
        }

        private static void RequireRegistered(string appId)
        {
            ValidateAppIdFormat(appId);
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId)) != null,
                "appId not registered");
        }

        private static void RequireAppAdmin(string appId)
        {
            UInt160 appAdmin = AppAdminOf(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app admin");
        }

        private static void RequireAppAdminOrPlatformAdmin(string appId)
        {
            if (IsPlatformAdminWitness()) return;
            UInt160 appAdmin = AppAdminOf(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app or platform admin");
        }

        private static void RequireNotGloballyPaused()
        {
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED_AT) == null,
                "registry paused");
        }

        private static void RequireAppNotPaused(string appId)
        {
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, AppKey(PREFIX_APP_PAUSED, appId)) == null,
                "app paused");
        }

        // Neo caps storage keys at 64 bytes; a raw 64-char appId plus prefix
        // and suffixes would overflow, so the id component is fixed to its
        // 20-byte Ripemd160 image. The spec's 64-char appId bound survives.
        private static ByteString AppKey(byte[] prefix, string id) =>
            Helper.Concat((ByteString)prefix, CryptoLib.Ripemd160((ByteString)id));

        private static ByteString AccountKey(byte[] prefix, UInt160 account) =>
            Helper.Concat((ByteString)prefix, (ByteString)account);
    }
}
