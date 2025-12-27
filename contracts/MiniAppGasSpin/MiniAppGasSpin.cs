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
    public delegate void SpinResultHandler(UInt160 player, BigInteger tier, BigInteger payout);

    [DisplayName("MiniAppGasSpin")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Gas Spin - Lucky wheel with VRF")]
    [ContractPermission("*", "*")]
    public class MiniAppGasSpin : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

        [DisplayName("SpinResult")]
        public static event SpinResultHandler OnSpinResult;

        public static void _deploy(object data, bool update) { if (!update) Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender); }
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        private static void ValidateAdmin() { ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized"); }
        public static void SetAdmin(UInt160 a) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, a); }
        public static void SetGateway(UInt160 g) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, g); }

        public static void Spin(UInt160 player, BigInteger bet, ByteString randomness)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "only gateway");
            BigInteger tier = ((byte[])randomness)[0] % 8;
            BigInteger mult = tier >= 6 ? 5 : tier >= 3 ? 2 : 0;
            OnSpinResult(player, tier, bet * mult * 90 / 100);
        }

        public static void OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e) { }
        public static void Update(ByteString nef, string m) { ValidateAdmin(); ContractManagement.Update(nef, m, null); }
    }
}
