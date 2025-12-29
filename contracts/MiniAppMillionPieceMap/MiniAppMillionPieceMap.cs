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
    public delegate void PieceClaimedHandler(BigInteger pieceId, UInt160 owner, BigInteger x, BigInteger y);
    public delegate void PieceTradedHandler(BigInteger pieceId, UInt160 from, UInt160 to, BigInteger price);
    public delegate void MapCompletedHandler(BigInteger mapId, UInt160[] owners);

    /// <summary>
    /// MillionPieceMap MiniApp - Collaborative world map ownership.
    /// Buy and trade map pieces, complete regions for bonuses.
    /// </summary>
    [DisplayName("MiniAppMillionPieceMap")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Million Piece Map - Collaborative map ownership")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-millionpiecemap";
        private const long PIECE_PRICE = 10000000; // 0.1 GAS
        private const int MAP_WIDTH = 100;
        private const int MAP_HEIGHT = 100;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PIECES = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_LISTINGS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct PieceData
        {
            public UInt160 Owner;
            public BigInteger X;
            public BigInteger Y;
            public BigInteger PurchaseTime;
            public BigInteger Price;
        }
        #endregion

        #region App Events
        [DisplayName("PieceClaimed")]
        public static event PieceClaimedHandler OnPieceClaimed;

        [DisplayName("PieceTraded")]
        public static event PieceTradedHandler OnPieceTraded;

        [DisplayName("MapCompleted")]
        public static event MapCompletedHandler OnMapCompleted;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }
        #endregion

        #region User-Facing Methods

        public static void ClaimPiece(UInt160 owner, BigInteger x, BigInteger y, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(x >= 0 && x < MAP_WIDTH, "invalid x");
            ExecutionEngine.Assert(y >= 0 && y < MAP_HEIGHT, "invalid y");

            ByteString pieceKey = GetPieceKey(x, y);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, pieceKey) == null, "already claimed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, PIECE_PRICE, receiptId);

            PieceData piece = new PieceData
            {
                Owner = owner,
                X = x,
                Y = y,
                PurchaseTime = Runtime.Time,
                Price = PIECE_PRICE
            };
            StorePiece(x, y, piece);

            OnPieceClaimed(x * MAP_HEIGHT + y, owner, x, y);
        }

        public static void ListForSale(BigInteger x, BigInteger y, UInt160 owner, BigInteger price)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            PieceData piece = GetPiece(x, y);
            ExecutionEngine.Assert(piece.Owner == owner, "not owner");

            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            Storage.Put(Storage.CurrentContext, listingKey, price);
        }

        public static void BuyPiece(BigInteger x, BigInteger y, UInt160 buyer, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            ByteString listingKey = Helper.Concat((ByteString)PREFIX_LISTINGS, GetPieceKey(x, y));
            ByteString priceData = Storage.Get(Storage.CurrentContext, listingKey);
            ExecutionEngine.Assert(priceData != null, "not for sale");

            BigInteger price = (BigInteger)priceData;
            PieceData piece = GetPiece(x, y);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(buyer), "unauthorized");

            ValidatePaymentReceipt(APP_ID, buyer, price, receiptId);

            UInt160 previousOwner = piece.Owner;
            piece.Owner = buyer;
            piece.Price = price;
            StorePiece(x, y, piece);

            Storage.Delete(Storage.CurrentContext, listingKey);

            OnPieceTraded(x * MAP_HEIGHT + y, previousOwner, buyer, price);
        }

        [Safe]
        public static PieceData GetPiece(BigInteger x, BigInteger y)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, GetPieceKey(x, y));
            if (data == null) return new PieceData();
            return (PieceData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static ByteString GetPieceKey(BigInteger x, BigInteger y)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_PIECES, (ByteString)x.ToByteArray()),
                (ByteString)y.ToByteArray());
        }

        private static void StorePiece(BigInteger x, BigInteger y, PieceData piece)
        {
            Storage.Put(Storage.CurrentContext, GetPieceKey(x, y), StdLib.Serialize(piece));
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
