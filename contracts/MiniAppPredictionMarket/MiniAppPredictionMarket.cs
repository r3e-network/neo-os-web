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
    public delegate void PredictionPlacedHandler(UInt160 player, string symbol, bool direction, BigInteger amount);
    public delegate void PredictionResolvedHandler(UInt160 player, bool won, BigInteger payout);

    [DisplayName("MiniAppPredictionMarket")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Prediction Market - Bet on price movements")]
    [ContractPermission("*", "*")]
    public class MiniAppPredictionMarket : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

        [DisplayName("PredictionPlaced")]
        public static event PredictionPlacedHandler OnPredictionPlaced;
        [DisplayName("PredictionResolved")]
        public static event PredictionResolvedHandler OnPredictionResolved;

        public static void _deploy(object data, bool update) { if (!update) Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender); }
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        private static void ValidateAdmin() { ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized"); }
        public static void SetAdmin(UInt160 a) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, a); }
        public static void SetGateway(UInt160 g) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, g); }

        public static void PlacePrediction(UInt160 player, string symbol, bool direction, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            OnPredictionPlaced(player, symbol, direction, amount);
        }

        public static void Resolve(UInt160 player, bool won, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == Gateway(), "only gateway");
            BigInteger payout = won ? amount * 190 / 100 : 0;
            OnPredictionResolved(player, won, payout);
        }

        public static void OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e) { }
        public static void Update(ByteString nef, string m) { ValidateAdmin(); ContractManagement.Update(nef, m, null); }
    }
}
