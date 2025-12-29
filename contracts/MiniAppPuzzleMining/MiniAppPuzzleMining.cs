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
    public delegate void PuzzleCreatedHandler(BigInteger puzzleId, UInt160 creator, BigInteger reward);
    public delegate void PieceMinedHandler(BigInteger puzzleId, UInt160 miner, BigInteger pieceId);
    public delegate void PuzzleCompletedHandler(BigInteger puzzleId, UInt160 winner, BigInteger reward);

    /// <summary>
    /// PuzzleMining MiniApp - Mine puzzle pieces, complete puzzles to win rewards.
    /// Collaborative mining where pieces are randomly distributed.
    /// </summary>
    [DisplayName("MiniAppPuzzleMining")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Puzzle Mining - Collaborative puzzle completion")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-puzzlemining";
        private const long MINING_FEE = 5000000; // 0.05 GAS
        private const int PIECES_PER_PUZZLE = 9;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PUZZLE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PUZZLES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PIECES = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct PuzzleData
        {
            public UInt160 Creator;
            public BigInteger Reward;
            public BigInteger PiecesMined;
            public bool Completed;
            public UInt160 Winner;
        }
        #endregion

        #region App Events
        [DisplayName("PuzzleCreated")]
        public static event PuzzleCreatedHandler OnPuzzleCreated;

        [DisplayName("PieceMined")]
        public static event PieceMinedHandler OnPieceMined;

        [DisplayName("PuzzleCompleted")]
        public static event PuzzleCompletedHandler OnPuzzleCompleted;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_PUZZLE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreatePuzzle(UInt160 creator, BigInteger reward, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(reward >= 100000000, "min 1 GAS reward");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, reward, receiptId);

            BigInteger puzzleId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PUZZLE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PUZZLE_ID, puzzleId);

            PuzzleData puzzle = new PuzzleData
            {
                Creator = creator,
                Reward = reward,
                PiecesMined = 0,
                Completed = false,
                Winner = UInt160.Zero
            };
            StorePuzzle(puzzleId, puzzle);

            OnPuzzleCreated(puzzleId, creator, reward);
            return puzzleId;
        }

        public static void MinePiece(BigInteger puzzleId, UInt160 miner, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            PuzzleData puzzle = GetPuzzle(puzzleId);
            ExecutionEngine.Assert(!puzzle.Completed, "puzzle completed");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(miner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, miner, MINING_FEE, receiptId);

            BigInteger pieceId = puzzle.PiecesMined + 1;
            puzzle.PiecesMined = pieceId;

            // Store piece ownership
            ByteString pieceKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_PIECES, (ByteString)puzzleId.ToByteArray()),
                (ByteString)pieceId.ToByteArray());
            Storage.Put(Storage.CurrentContext, pieceKey, miner);

            if (pieceId >= PIECES_PER_PUZZLE)
            {
                puzzle.Completed = true;
                puzzle.Winner = miner;
                OnPuzzleCompleted(puzzleId, miner, puzzle.Reward);
            }

            StorePuzzle(puzzleId, puzzle);
            OnPieceMined(puzzleId, miner, pieceId);
        }

        [Safe]
        public static PuzzleData GetPuzzle(BigInteger puzzleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PUZZLES, (ByteString)puzzleId.ToByteArray()));
            if (data == null) return new PuzzleData();
            return (PuzzleData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StorePuzzle(BigInteger puzzleId, PuzzleData puzzle)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PUZZLES, (ByteString)puzzleId.ToByteArray()),
                StdLib.Serialize(puzzle));
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
