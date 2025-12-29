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
    public delegate void ThroneClaimedHandler(UInt160 newKing, BigInteger price, UInt160 previousKing);
    public delegate void TaxCollectedHandler(UInt160 king, BigInteger amount);

    /// <summary>
    /// Throne of GAS MiniApp - King of the hill game.
    /// Pay more than the current king to claim the throne and earn taxes.
    /// </summary>
    [DisplayName("MiniAppThroneOfGas")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Throne of GAS - King of the hill")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-throne-of-gas";
        private const int TAX_RATE_PERCENT = 10;
        private const int MIN_INCREASE_PERCENT = 110; // Must pay 110% of current price
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_KING = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PRICE = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_EARNINGS = new byte[] { 0x12 };
        #endregion

        #region Events
        [DisplayName("ThroneClaimed")]
        public static event ThroneClaimedHandler OnThroneClaimed;

        [DisplayName("TaxCollected")]
        public static event TaxCollectedHandler OnTaxCollected;
        #endregion

        #region Getters
        [Safe]
        public static UInt160 CurrentKing() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_KING);

        [Safe]
        public static BigInteger ThronePrice() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PRICE);

        [Safe]
        public static BigInteger KingEarnings() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EARNINGS);
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PRICE, 100000000); // 1 GAS initial
        }
        #endregion

        #region User Methods
        public static void ClaimThrone(UInt160 player, BigInteger bid, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            BigInteger currentPrice = ThronePrice();
            BigInteger minBid = currentPrice * MIN_INCREASE_PERCENT / 100;
            ExecutionEngine.Assert(bid >= minBid, "bid too low");

            ValidatePaymentReceipt(APP_ID, player, bid, receiptId);

            UInt160 previousKing = CurrentKing();
            BigInteger tax = bid * TAX_RATE_PERCENT / 100;

            // Update state
            Storage.Put(Storage.CurrentContext, PREFIX_KING, player);
            Storage.Put(Storage.CurrentContext, PREFIX_PRICE, bid);
            Storage.Put(Storage.CurrentContext, PREFIX_EARNINGS, tax);

            OnThroneClaimed(player, bid, previousKing);
            if (tax > 0)
            {
                OnTaxCollected(player, tax);
            }
        }
        #endregion
    }
}
