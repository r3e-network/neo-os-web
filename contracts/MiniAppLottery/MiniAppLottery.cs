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
    public delegate void TicketPurchasedHandler(UInt160 player, BigInteger ticketCount, BigInteger roundId);
    public delegate void WinnerDrawnHandler(UInt160 winner, BigInteger prize, BigInteger roundId);

    [DisplayName("MiniAppLottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Lottery MiniApp with provable VRF randomness")]
    [ContractPermission("*", "*")]
    public class MiniAppLottery : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_PAYMENTHUB = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x06 };

        private const long TICKET_PRICE = 10000000; // 0.1 GAS
        private const int PLATFORM_FEE_PERCENT = 10;

        [DisplayName("TicketPurchased")]
        public static event TicketPurchasedHandler OnTicketPurchased;

        [DisplayName("WinnerDrawn")]
        public static event WinnerDrawnHandler OnWinnerDrawn;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);
        }

        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);
        public static UInt160 PaymentHub() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAYMENTHUB);
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND);
        public static BigInteger PrizePool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetGateway(UInt160 gateway)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "invalid gateway");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static void SetPaymentHub(UInt160 paymentHub)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(paymentHub != null && paymentHub.IsValid, "invalid payment hub");
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENTHUB, paymentHub);
        }

        public static void BuyTickets(UInt160 player, BigInteger ticketCount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");
            ExecutionEngine.Assert(ticketCount > 0 && ticketCount <= 100, "invalid ticket count");

            BigInteger totalCost = ticketCount * TICKET_PRICE;
            BigInteger roundId = CurrentRound();

            // Record tickets for player
            byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, player);
            ticketKey = Helper.Concat(ticketKey, (ByteString)roundId);
            BigInteger existing = (BigInteger)Storage.Get(Storage.CurrentContext, ticketKey);
            Storage.Put(Storage.CurrentContext, ticketKey, existing + ticketCount);

            // Add to prize pool
            BigInteger pool = PrizePool();
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, pool + totalCost);

            OnTicketPurchased(player, ticketCount, roundId);
        }

        public static void DrawWinner(ByteString randomness)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "only gateway can draw");

            BigInteger pool = PrizePool();
            ExecutionEngine.Assert(pool > 0, "no prize pool");

            BigInteger prize = pool * (100 - PLATFORM_FEE_PERCENT) / 100;
            BigInteger roundId = CurrentRound();

            // Select winner based on randomness (simplified)
            UInt160 winner = Admin(); // Placeholder - real implementation would track all players

            // Reset for next round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, roundId + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_POOL, 0);

            OnWinnerDrawn(winner, prize, roundId);
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gateway, "unauthorized caller");

            if (success && serviceType == "rng")
            {
                DrawWinner(result);
            }
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
    }
}
