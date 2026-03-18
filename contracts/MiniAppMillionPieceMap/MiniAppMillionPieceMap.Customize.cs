using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Customize Methods

        /// <summary>
        /// Customize a piece with metadata.
        /// </summary>
        public static void CustomizePiece(BigInteger x, BigInteger y, UInt160 owner, string metadata)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(metadata.Length <= MAX_METADATA_LENGTH, "metadata too long");
            ValidateUserOrAbstractAccount(owner);

            PieceData piece = GetPiece(x, y);
            ExecutionEngine.Assert(piece.Owner == owner, "not owner");

            ConsumeDirectGasCredit(owner, CUSTOMIZE_FEE);

            piece.Metadata = metadata;
            StorePiece(x, y, piece);

            OnPieceCustomized(x * MAP_HEIGHT + y, owner, metadata);
        }

        #endregion
    }
}
