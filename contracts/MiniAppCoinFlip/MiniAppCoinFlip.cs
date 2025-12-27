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
    public delegate void BetPlacedHandler(UInt160 player, BigInteger amount, bool choice, BigInteger betId);
    public delegate void BetResolvedHandler(UInt160 player, BigInteger payout, bool won, BigInteger betId);

    [DisplayName("MiniAppCoinFlip")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Coin Flip MiniApp - 50/50 double or nothing")]
    [ContractPermission("*", "*")]
    public class MiniAppCoinFlip : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x04 };

        private const int PLATFORM_FEE_PERCENT = 5;

        [DisplayName("BetPlaced")]
        public static event BetPlacedHandler OnBetPlaced;

        [DisplayName("BetResolved")]
        public static event BetResolvedHandler OnBetResolved;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, 0);
        }

        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && Runtime.CheckWitness(admin), "unauthorized");
        }

        public static void SetAdmin(UInt160 newAdmin) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin); }
        public static void SetGateway(UInt160 gateway) { ValidateAdmin(); Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway); }

        public static BigInteger PlaceBet(UInt160 player, BigInteger amount, bool choice)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            ExecutionEngine.Assert(amount >= 5000000, "min bet 0.05 GAS");

            BigInteger betId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, betId);
            OnBetPlaced(player, amount, choice, betId);
            return betId;
        }

        public static void ResolveBet(BigInteger betId, UInt160 player, BigInteger amount, bool choice, ByteString randomness)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "only gateway");

            bool outcome = ((byte[])randomness)[0] % 2 == 0;
            bool won = outcome == choice;
            BigInteger payout = won ? amount * 2 * (100 - PLATFORM_FEE_PERCENT) / 100 : 0;
            OnBetResolved(player, payout, won, betId);
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "unauthorized");
        }

        public static void Update(ByteString nefFile, string manifest) { ValidateAdmin(); ContractManagement.Update(nefFile, manifest, null); }
    }
}
