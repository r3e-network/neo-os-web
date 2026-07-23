using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    [DisplayName("PlatformDeFi")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Test-only payer-global PlatformDeFi credit fixture; never deployed.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")]
    [ContractPermission("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd", "update")]
    public class PlatformDeFiLegacyCreditFixture : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x15 };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_ADMIN,
                Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin()
        {
            ByteString value =
                Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        [Safe]
        public static bool IsPaused()
        {
            ByteString value =
                Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return value != null && (BigInteger)value == 1;
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_PAUSED,
                paused ? 1 : 0);
        }

        public static void OnNEP17Payment(
            UInt160 from,
            BigInteger amount,
            object data)
        {
            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(
                caller == NEO.Hash || caller == GAS.Hash,
                "unsupported asset");
            ExecutionEngine.Assert(
                from != UInt160.Zero && from.IsValid,
                "invalid payer");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            byte[] prefix =
                caller == NEO.Hash ? PREFIX_NEO_CREDIT : PREFIX_GAS_CREDIT;
            ByteString key = Helper.Concat(
                (ByteString)prefix,
                (ByteString)(byte[])from);
            ByteString value = Storage.Get(Storage.CurrentContext, key);
            BigInteger balance =
                value == null ? 0 : (BigInteger)value;
            Storage.Put(Storage.CurrentContext, key, balance + amount);
        }

        public static void SweepGas(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(
                recipient != UInt160.Zero && recipient.IsValid,
                "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(
                GAS.Transfer(
                    Runtime.ExecutingScriptHash,
                    recipient,
                    amount),
                "sweep failed");
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(IsPaused(), "pause before update");
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(
                admin != UInt160.Zero &&
                Runtime.CheckWitness(admin),
                "admin only");
        }
    }
}
