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
    /// RegistryMockFixture idiom). It records the registry's activateApp
    /// pushes and validateAndApplyDescriptor forwards so tests can assert
    /// the engine-table wiring, exposes a toggle that makes descriptor
    /// validation reject (proving engine-side rejection propagates), and
    /// accepts the memo-routed "appId:credit" GAS that fundEnginePool
    /// forwards. Never deployed to any network.
    /// </summary>
    [DisplayName("EngineMockFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "In-engine counterparty recording registry pushes for PlatformRegistry tests; never deployed.")]
    public class EngineMockFixture : SmartContract
    {
        private static readonly byte[] PREFIX_ACTIVATION_COUNT = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_ACTIVATED_ADMIN = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_DESCRIPTOR = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_REJECT_DESCRIPTORS = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_POOL_CREDIT = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_LAST_MEMO = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_LAST_PAYER = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_ACTIVATION_KEYS = new byte[] { 0x08 };

        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            ByteString countKey = Key(PREFIX_ACTIVATION_COUNT, appId);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
            Storage.Put(Storage.CurrentContext, Key(PREFIX_ACTIVATED_ADMIN, appId), appAdmin);
            BigInteger descriptorKeys = 0;
            if (descriptor != null) descriptorKeys = descriptor.Keys.Length;
            Storage.Put(Storage.CurrentContext, Key(PREFIX_ACTIVATION_KEYS, appId), descriptorKeys);
        }

        public static void ValidateAndApplyDescriptor(string appId, string key, object value)
        {
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS) == null,
                "engine rejects descriptor");
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(Key(PREFIX_DESCRIPTOR, appId), (ByteString)(":" + key)),
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
            ExecutionEngine.Assert(appId.Length > 0 && memo == appId + ":credit", "invalid payment memo");
            ByteString poolKey = Key(PREFIX_POOL_CREDIT, appId);
            BigInteger pool = (BigInteger)Storage.Get(Storage.CurrentContext, poolKey);
            Storage.Put(Storage.CurrentContext, poolKey, pool + amount);
            Storage.Put(Storage.CurrentContext, Key(PREFIX_LAST_MEMO, appId), memo);
            Storage.Put(Storage.CurrentContext, Key(PREFIX_LAST_PAYER, appId), from);
        }

        public static void SetRejectDescriptors(bool reject)
        {
            if (reject) Storage.Put(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS, 1);
            else Storage.Delete(Storage.CurrentContext, PREFIX_REJECT_DESCRIPTORS);
        }

        [Safe]
        public static BigInteger ActivationCountOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_ACTIVATION_COUNT, appId));

        [Safe]
        public static BigInteger ActivationDescriptorKeysOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_ACTIVATION_KEYS, appId));

        [Safe]
        public static UInt160 ActivatedAdminOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, Key(PREFIX_ACTIVATED_ADMIN, appId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static object AppliedDescriptorOf(string appId, string key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext,
                Helper.Concat(Key(PREFIX_DESCRIPTOR, appId), (ByteString)(":" + key)));
            return raw == null ? null : StdLib.Deserialize(raw);
        }

        [Safe]
        public static BigInteger PoolCreditOf(string appId) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_POOL_CREDIT, appId));

        [Safe]
        public static string LastPoolMemoOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, Key(PREFIX_LAST_MEMO, appId));
            return raw == null ? "" : (string)raw;
        }

        [Safe]
        public static UInt160 LastPoolPayerOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, Key(PREFIX_LAST_PAYER, appId));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        private static ByteString Key(byte[] prefix, string appId) =>
            Helper.Concat((ByteString)prefix, (ByteString)appId);
    }
}
