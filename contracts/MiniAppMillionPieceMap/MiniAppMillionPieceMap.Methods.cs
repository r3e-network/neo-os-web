using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Claim Methods

        /// <summary>
        /// Claim an unclaimed piece on the map.
        /// </summary>
        public static void ClaimPiece(UInt160 owner, BigInteger x, BigInteger y, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(x >= 0 && x < MAP_WIDTH, "invalid x");
            ExecutionEngine.Assert(y >= 0 && y < MAP_HEIGHT, "invalid y");

            ByteString pieceKey = GetPieceKey(x, y);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, pieceKey) == null, "already claimed");

            ValidateUserOrAbstractAccount(owner);

            ValidatePaymentReceipt(APP_ID, owner, PIECE_PRICE, receiptId);

            BigInteger regionId = GetRegionId(x, y);

            PieceData piece = new PieceData
            {
                Owner = owner,
                X = x,
                Y = y,
                RegionId = regionId,
                PurchaseTime = Runtime.Time,
                Price = PIECE_PRICE,
                Metadata = "",
                TradeCount = 0,
                LastTradeTime = 0
            };
            StorePiece(x, y, piece);

            AddUserPiece(owner, x, y);
            UpdateUserStatsOnClaim(owner);
            UpdateRegionOnClaim(regionId, owner);

            BigInteger totalClaimed = TotalClaimed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CLAIMED, totalClaimed + 1);

            CheckClaimAchievements(owner);

            OnPieceClaimed(x * MAP_HEIGHT + y, owner, x, y, regionId);
        }

        #endregion
    }
}
