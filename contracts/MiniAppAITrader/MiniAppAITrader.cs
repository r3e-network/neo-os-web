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
    public delegate void TradeExecutedHandler(UInt160 trader, string pair, bool isBuy, BigInteger amount, BigInteger price);

    [DisplayName("MiniAppAITrader")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "AI Trader - AI-powered trading bot")]
    [ContractPermission("*", "*")]
    public class MiniAppAITrader : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

        [DisplayName("TradeExecuted")]
        public static event TradeExecutedHandler OnTradeExecuted;

        public static void _deploy(object data, bool update) { if (!update) Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender); }
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        private static void ValidateAdmin() { ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized"); }
        public static void SetAdmin(UInt160 a) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, a); }
        public static void SetGateway(UInt160 g) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, g); }

        public static void ExecuteTrade(UInt160 trader, string pair, bool isBuy, BigInteger amount, BigInteger price)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "only gateway");
            OnTradeExecuted(trader, pair, isBuy, amount, price);
        }

        public static void OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e) { }
        public static void Update(ByteString nef, string m) { ValidateAdmin(); ContractManagement.Update(nef, m, null); }
    }
}
