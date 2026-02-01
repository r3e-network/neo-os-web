using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Trading Methods

        /// <summary>
        /// List a piece for sale.
        /// </summary>
        public static void ListForSale(BigInteger x, BigInteger y, UInt160 owner, BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(price > 0, "invalid price");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            PieceData piece = GetPiece(x, y);
            ExecutionEngine.Assert(piece.Owner == owner, "not owner");

            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            Storage.Put(Storage.CurrentContext, listingKey, price);

            OnPieceListed(x * MAP_HEIGHT + y, owner, price);
        }

        /// <summary>
        /// Remove a piece from sale.
        /// </summary>
        public static void DelistPiece(BigInteger x, BigInteger y, UInt160 owner)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            PieceData piece = GetPiece(x, y);
            ExecutionEngine.Assert(piece.Owner == owner, "not owner");

            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, listingKey) != null, "not listed");

            Storage.Delete(Storage.CurrentContext, listingKey);

            OnPieceDelisted(x * MAP_HEIGHT + y, owner);
        }

        /// <summary>
        /// Buy a listed piece.
        /// </summary>
        public static void BuyPiece(BigInteger x, BigInteger y, UInt160 buyer, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            ByteString priceData = Storage.Get(Storage.CurrentContext, listingKey);
            ExecutionEngine.Assert(priceData != null, "not for sale");

            BigInteger price = (BigInteger)priceData;
            PieceData piece = GetPiece(x, y);
            UInt160 previousOwner = piece.Owner;

            ExecutionEngine.Assert(previousOwner != buyer, "already owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            ValidatePaymentReceipt(APP_ID, buyer, price, receiptId);

            piece.Owner = buyer;
            piece.Price = price;
            piece.TradeCount += 1;
            piece.LastTradeTime = Runtime.Time;
            StorePiece(x, y, piece);

            Storage.Delete(Storage.CurrentContext, listingKey);

            RemoveUserPiece(previousOwner, x, y);
            AddUserPiece(buyer, x, y);

            UpdateUserStatsOnBuy(buyer, price);
            UpdateUserStatsOnSell(previousOwner, price);

            BigInteger totalTraded = TotalTraded();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_TRADED, totalTraded + 1);

            BigInteger totalVolume = TotalVolume();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOLUME, totalVolume + price);

            CheckTraderAchievement(buyer);

            OnPieceTraded(x * MAP_HEIGHT + y, previousOwner, buyer, price);
        }

        #endregion
    }
}
