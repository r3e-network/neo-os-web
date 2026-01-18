using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetPieceDetails(BigInteger x, BigInteger y)
        {
            PieceData piece = GetPiece(x, y);
            Map<string, object> details = new Map<string, object>();
            if (piece.Owner == UInt160.Zero) return details;

            details["x"] = piece.X;
            details["y"] = piece.Y;
            details["owner"] = piece.Owner;
            details["regionId"] = piece.RegionId;
            details["purchaseTime"] = piece.PurchaseTime;
            details["price"] = piece.Price;
            details["metadata"] = piece.Metadata;
            details["tradeCount"] = piece.TradeCount;
            details["lastTradeTime"] = piece.LastTradeTime;

            BigInteger listingPrice = GetListingPrice(x, y);
            details["isListed"] = listingPrice > 0;
            if (listingPrice > 0)
            {
                details["listingPrice"] = listingPrice;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetRegionDetails(BigInteger regionId)
        {
            RegionData region = GetRegion(regionId);
            Map<string, object> details = new Map<string, object>();

            details["id"] = regionId;
            details["claimedPieces"] = region.ClaimedPieces;
            details["totalPieces"] = REGION_SIZE * REGION_SIZE;
            details["completionPercent"] = region.ClaimedPieces * 100 / (REGION_SIZE * REGION_SIZE);
            details["completed"] = region.Completed;

            if (region.Completed)
            {
                details["completer"] = region.Completer;
                details["completionTime"] = region.CompletionTime;
                details["bonusPaid"] = region.BonusPaid;
            }

            BigInteger regionX = regionId % (MAP_WIDTH / REGION_SIZE);
            BigInteger regionY = regionId / (MAP_WIDTH / REGION_SIZE);
            details["regionX"] = regionX;
            details["regionY"] = regionY;
            details["startX"] = regionX * REGION_SIZE;
            details["startY"] = regionY * REGION_SIZE;

            return details;
        }

        #endregion
    }
}
