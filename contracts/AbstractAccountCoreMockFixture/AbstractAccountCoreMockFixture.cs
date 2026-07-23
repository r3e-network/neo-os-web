using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("AbstractAccountCoreMockFixture")]
    [ManifestExtra("Description", "Test-only shared AA core counterparty for PlatformRegistry integration tests; never deployed.")]
    public class AbstractAccountCoreMockFixture : SmartContract
    {
        private static readonly byte[] PrefixRegistrar = new byte[] { 0x01 };
        private static readonly byte[] PrefixOwner = new byte[] { 0x02 };

        public static void SetRegistrar(UInt160 registrar)
        {
            Storage.Put(Storage.CurrentContext, PrefixRegistrar, registrar);
        }

        [Safe]
        public static UInt160 ComputePlatformAccountId(ByteString appBinding, UInt160 backupOwner, uint escapeTimelock)
        {
            ByteString payload = Helper.Concat(appBinding, (ByteString)backupOwner);
            payload = Helper.Concat(payload, (ByteString)((BigInteger)escapeTimelock).ToByteArray());
            return (UInt160)CryptoLib.Ripemd160(CryptoLib.Sha256(payload));
        }

        public static void RegisterPlatformAccount(UInt160 accountId, ByteString appBinding, UInt160 backupOwner, uint escapeTimelock)
        {
            ByteString rawRegistrar = Storage.Get(Storage.CurrentContext, PrefixRegistrar);
            ExecutionEngine.Assert(rawRegistrar != null, "registrar not set");
            UInt160 registrar = (UInt160)rawRegistrar;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registrar, "unauthorized registrar");
            ExecutionEngine.Assert(
                accountId == ComputePlatformAccountId(appBinding, backupOwner, escapeTimelock),
                "account id mismatch");
            ByteString key = Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "account exists");
            Storage.Put(Storage.CurrentContext, key, backupOwner);
        }

        [Safe]
        public static UInt160 GetBackupOwner(UInt160 accountId)
        {
            ByteString value = Storage.Get(
                Storage.CurrentContext,
                Helper.Concat((ByteString)PrefixOwner, (ByteString)accountId));
            return value == null ? UInt160.Zero : (UInt160)value;
        }
    }
}
