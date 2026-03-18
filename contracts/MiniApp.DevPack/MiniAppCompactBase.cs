using System.ComponentModel;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Minimal shared base for current miniapp contracts that only need
    /// admin / pause / gateway helpers and direct upgrade controls.
    ///
    /// Keep this layer small and current. It exists to avoid duplicating
    /// identical runtime helpers across multiple business contracts.
    /// </summary>
    public abstract class MiniAppBase : SmartContract
    {
        protected static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        protected static readonly byte[] PREFIX_ORACLE = new byte[] { 0x02 };
        protected static readonly byte[] PREFIX_PAYMENTHUB = new byte[] { 0x03 };
        protected static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };
        protected static readonly byte[] PREFIX_PAUSE_REGISTRY = new byte[] { 0x05 };
        protected static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x06 };

        private static UInt160 ReadHash(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value is null ? UInt160.Zero : (UInt160)value;
        }

        [Safe]
        public static UInt160 Admin() => ReadHash(PREFIX_ADMIN);

        [Safe]
        public static UInt160 Oracle() => ReadHash(PREFIX_ORACLE);

        [Safe]
        public static UInt160 PaymentHub() => ReadHash(PREFIX_PAYMENTHUB);

        [Safe]
        public static UInt160 PauseRegistry() => ReadHash(PREFIX_PAUSE_REGISTRY);

        [Safe]
        public static UInt160 Gateway() => ReadHash(PREFIX_GATEWAY);

        [Safe]
        public static bool IsPaused()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return value is not null && (BigInteger)value == 1;
        }

        protected static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        protected static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        protected static void ValidateNotGloballyPaused(string appId)
        {
            ExecutionEngine.Assert(!IsPaused(), "paused");

            UInt160 registry = PauseRegistry();
            if (registry != UInt160.Zero && registry.IsValid)
            {
                bool globalPaused = (bool)Contract.Call(registry, "isPaused", CallFlags.ReadOnly, new object[] { appId });
                ExecutionEngine.Assert(!globalPaused, "globally paused");
            }
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
        }

        public static void SetPaymentHub(UInt160 hub)
        {
            ValidateAdmin();
            ValidateAddress(hub);
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENTHUB, hub);
        }

        public static void SetPauseRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY, registry);
        }

        public static void SetGateway(UInt160 gateway)
        {
            ValidateAdmin();
            ValidateAddress(gateway);
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
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

        public static void Destroy()
        {
            ValidateAdmin();
            ContractManagement.Destroy();
        }
    }
}
