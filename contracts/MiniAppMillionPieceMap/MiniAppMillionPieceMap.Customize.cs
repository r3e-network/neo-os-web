using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Customize Methods

        /// <summary>
        /// Customize a piece with metadata.
        /// </summary>
        public static void CustomizePiece(BigInteger x, BigInteger y, UInt160 owner, string metadata, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(metadata.Length <= MAX_METADATA_LENGTH, "metadata too long");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            PieceData piece = GetPiece(x, y);
            ExecutionEngine.Assert(piece.Owner == owner, "not owner");

            ValidatePaymentReceipt(APP_ID, owner, CUSTOMIZE_FEE, receiptId);

            piece.Metadata = metadata;
            StorePiece(x, y, piece);

            OnPieceCustomized(x * MAP_HEIGHT + y, owner, metadata);
        }

        #endregion
    }
}
