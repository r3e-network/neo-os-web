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
    public delegate void AuctionCreatedHandler(BigInteger auctionId, BigInteger startPrice, BigInteger endPrice, BigInteger duration);
    public delegate void AuctionPurchasedHandler(UInt160 buyer, BigInteger auctionId, BigInteger price);

    /// <summary>
    /// Dutch Auction MiniApp - Reverse auction where price drops over time.
    /// </summary>
    [DisplayName("MiniAppDutchAuction")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DutchAuction is a descending price auction for fair price discovery. Use it to sell assets through time-based price reduction, you can achieve efficient market-driven pricing without minimum bid requirements.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dutch-auction";
        private const int PLATFORM_FEE_PERCENT = 5;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_AUCTION_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_AUCTION = new byte[] { 0x11 };
        #endregion

        #region Auction Structure
        public struct Auction
        {
            public BigInteger StartPrice;
            public BigInteger EndPrice;
            public BigInteger StartTime;
            public BigInteger Duration;
            public bool Sold;
            public UInt160 Buyer;
        }
        #endregion

        #region Events
        [DisplayName("AuctionCreated")]
        public static event AuctionCreatedHandler OnAuctionCreated;

        [DisplayName("AuctionPurchased")]
        public static event AuctionPurchasedHandler OnAuctionPurchased;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger CurrentAuctionId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_AUCTION_ID);

        [Safe]
        public static Auction GetAuction(BigInteger auctionId)
        {
            byte[] key = Helper.Concat(PREFIX_AUCTION, (ByteString)auctionId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return new Auction();
            return (Auction)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetCurrentPrice(BigInteger auctionId)
        {
            Auction auction = GetAuction(auctionId);
            if (auction.Sold) return 0;

            BigInteger elapsed = Runtime.Time - auction.StartTime;
            if (elapsed >= auction.Duration) return auction.EndPrice;

            BigInteger priceDrop = (auction.StartPrice - auction.EndPrice) * elapsed / auction.Duration;
            return auction.StartPrice - priceDrop;
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_AUCTION_ID, 0);
        }
        #endregion

        #region Admin Methods
        public static BigInteger CreateAuction(BigInteger startPrice, BigInteger endPrice, BigInteger duration)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(startPrice > endPrice, "start > end");
            ExecutionEngine.Assert(duration > 0, "duration > 0");

            BigInteger auctionId = CurrentAuctionId() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_AUCTION_ID, auctionId);

            Auction auction = new Auction
            {
                StartPrice = startPrice,
                EndPrice = endPrice,
                StartTime = Runtime.Time,
                Duration = duration,
                Sold = false,
                Buyer = UInt160.Zero
            };

            byte[] key = Helper.Concat(PREFIX_AUCTION, (ByteString)auctionId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(auction));

            OnAuctionCreated(auctionId, startPrice, endPrice, duration);
            return auctionId;
        }
        #endregion

        #region User Methods
        public static void Purchase(UInt160 buyer, BigInteger auctionId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            Auction auction = GetAuction(auctionId);
            ExecutionEngine.Assert(!auction.Sold, "already sold");
            ExecutionEngine.Assert(auction.StartTime > 0, "auction not found");

            BigInteger currentPrice = GetCurrentPrice(auctionId);
            ValidatePaymentReceipt(APP_ID, buyer, currentPrice, receiptId);

            auction.Sold = true;
            auction.Buyer = buyer;

            byte[] key = Helper.Concat(PREFIX_AUCTION, (ByteString)auctionId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(auction));

            OnAuctionPurchased(buyer, auctionId, currentPrice);
        }

        /// <summary>
        /// SECURITY FIX: Allow admin to withdraw auction proceeds.
        /// </summary>
        public static void WithdrawProceeds(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(recipient);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw failed");
        }
        #endregion
    }
}
