using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Test-only engine counterparty for the PlatformRegistry suites (the
    /// RegistryMockFixture idiom), built on the shared MiniAppEngineBase
    /// plumbing (design section 3.5): its activateApp / validateAndApplyDescriptor
    /// assert caller == the bound registry through the base, and its storage
    /// keys ride the canonical AppKey kit. It records the registry's
    /// activateApp pushes and validateAndApplyDescriptor forwards so tests
    /// can assert the engine-table wiring, exposes a toggle that makes
    /// descriptor validation reject (proving engine-side rejection
    /// propagates), and accepts the memo-routed "appId:fund" GAS that
    /// fundEnginePool forwards. Never deployed to any network.
    /// </summary>
    [DisplayName("EngineMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "In-engine counterparty recording registry pushes for PlatformRegistry tests; never deployed.")]
    public class EngineMockFixture : MiniAppEngineBase
    {
        // Mock-owned prefixes live in the module band (0x10+, per the base's
        // reserved map); 0x01-0x0F belong to MiniAppEngineBase.
        private static readonly byte[] PREFIX_ACTIVATION_COUNT = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ACTIVATED_ADMIN = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_DESCRIPTOR = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REJECT_DESCRIPTORS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_POOL_CREDIT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_LAST_MEMO = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_LAST_PAYER = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_ACTIVATION_KEYS = new byte[] { 0x17 };

        /// <summary>
        /// Bind the trusted PlatformRegistry once (the fixture mirrors
        /// ReentrantEngineMockFixture.Arm: no admin concept on a test
        /// double). The registry push lanes assert against this hash.
        /// </summary>
        public static void SetRegistry(UInt160 registry)
        {
            ExecutionEngine.Assert(RegistryHash() == UInt160.Zero, "registry already bound");
            StoreRegistryHash(registry);
        }

        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            // Base plumbing: caller == registry, then the tenant admin row.
            ActivateTenant(appId, appAdmin);
            byte[] countKey = AppKey(appId, PREFIX_ACTIVATION_COUNT);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_ACTIVATED_ADMIN), appAdmin);
            BigInteger descriptorKeys = 0;
            if (descriptor != null) descriptorKeys = descriptor.Keys.Length;
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_ACTIVATION_KEYS), descriptorKeys);
        }

        public static void ValidateAndApplyDescriptor(string appId, string key, object value)
        {
            // Base plumbing: caller == registry, tenant must be activated.
            RequireRegistryCaller();
            RequireRegistered(appId);
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS) == null,
                "engine rejects descriptor");
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)AppKey(appId, PREFIX_DESCRIPTOR), (ByteString)(":" + key)),
                StdLib.Serialize(value));
        }

        // Accept-only pool intake mirroring the PlatformGame memo grammar:
        // credits the per-app pool ledger, moves nothing out.
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            string memo = data == null ? "" : (string)(ByteString)data;
            string appId = "";
            for (int i = 0; i < memo.Length; i++)
            {
                if (memo[i] == ':') { appId = memo.Substring(0, i); break; }
            }
            ExecutionEngine.Assert(appId.Length > 0 && memo == appId + ":fund", "invalid payment memo");
            byte[] poolKey = AppKey(appId, PREFIX_POOL_CREDIT);
            BigInteger pool = (BigInteger)Storage.Get(Storage.CurrentContext, poolKey);
            Storage.Put(Storage.CurrentContext, poolKey, pool + amount);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_LAST_MEMO), memo);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_LAST_PAYER), from);
        }

        public static void SetRejectDescriptors(bool reject)
        {
            if (reject) Storage.Put(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS, 1);
            else Storage.Delete(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS);
        }

        [Safe]
        public static BigInteger ActivationCountOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_ACTIVATION_COUNT));

        [Safe]
        public static BigInteger ActivationDescriptorKeysOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_ACTIVATION_KEYS));

        [Safe]
        public static UInt160 ActivatedAdminOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_ACTIVATED_ADMIN));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static object AppliedDescriptorOf(string appId, string key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)AppKey(appId, PREFIX_DESCRIPTOR), (ByteString)(":" + key)));
            return raw == null ? null : StdLib.Deserialize(raw);
        }

        [Safe]
        public static BigInteger PoolCreditOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_POOL_CREDIT));

        [Safe]
        public static string LastPoolMemoOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_LAST_MEMO));
            return raw == null ? "" : (string)raw;
        }

        [Safe]
        public static UInt160 LastPoolPayerOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_LAST_PAYER));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }
    }
}
