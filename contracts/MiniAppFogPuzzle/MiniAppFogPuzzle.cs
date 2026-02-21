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
    public delegate void PuzzleStartedHandler(BigInteger puzzleId, UInt160 player);
    public delegate void TileRevealedHandler(BigInteger puzzleId, BigInteger tileId, bool hasPrize);
    public delegate void PuzzleSolvedHandler(BigInteger puzzleId, UInt160 winner, BigInteger reward);

    /// <summary>
    /// FogPuzzle MiniApp - Hidden puzzle with fog of war mechanics.
    /// Pay to reveal tiles, find the hidden treasure.
    /// </summary>
    [DisplayName("MiniAppFogPuzzle")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. FogPuzzle is a treasure hunt application with fog-of-war mechanics. Use it to reveal hidden tiles by paying GAS, you can discover treasures and win rewards.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-fogpuzzle";
        private const long REVEAL_FEE = 5000000; // 0.05 GAS
        private const int GRID_SIZE = 10;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_PUZZLE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_PUZZLES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TILES = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct FogPuzzleData
        {
            public UInt160 Creator;
            public BigInteger Prize;
            public BigInteger TreasureX;
            public BigInteger TreasureY;
            public BigInteger RevealCount;
            public bool Solved;
            public UInt160 Winner;
        }
        #endregion

        #region App Events
        [DisplayName("PuzzleStarted")]
        public static event PuzzleStartedHandler OnPuzzleStarted;

        [DisplayName("TileRevealed")]
        public static event TileRevealedHandler OnTileRevealed;

        [DisplayName("PuzzleSolved")]
        public static event PuzzleSolvedHandler OnPuzzleSolved;
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

        public static BigInteger CreatePuzzle(UInt160 creator, BigInteger prize, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(prize >= 100000000, "min 1 GAS prize");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, prize, receiptId);

            BigInteger puzzleId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PUZZLE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_PUZZLE_ID, puzzleId);

            BigInteger requestId = RequestRng(puzzleId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()),
                StdLib.Serialize(new object[] { puzzleId, creator, prize }));

            return puzzleId;
        }

        public static bool RevealTile(BigInteger puzzleId, UInt160 player, BigInteger x, BigInteger y, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE, "invalid coords");

            FogPuzzleData puzzle = GetPuzzle(puzzleId);
            ExecutionEngine.Assert(!puzzle.Solved, "already solved");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, REVEAL_FEE, receiptId);

            puzzle.RevealCount += 1;
            puzzle.Prize += REVEAL_FEE;

            bool found = (x == puzzle.TreasureX && y == puzzle.TreasureY);

            if (found)
            {
                puzzle.Solved = true;
                puzzle.Winner = player;
                OnPuzzleSolved(puzzleId, player, puzzle.Prize);
            }

            StorePuzzle(puzzleId, puzzle);
            OnTileRevealed(puzzleId, x * GRID_SIZE + y, found);
            return found;
        }

        [Safe]
        public static FogPuzzleData GetPuzzle(BigInteger puzzleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PUZZLES, (ByteString)puzzleId.ToByteArray()));
            if (data == null) return new FogPuzzleData();
            return (FogPuzzleData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Callbacks

        private static BigInteger RequestRng(BigInteger puzzleId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { puzzleId });
            return (BigInteger)Contract.Call(gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload, Runtime.ExecutingScriptHash, "onServiceCallback");
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString reqData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
            if (reqData == null) return;

            object[] req = (object[])StdLib.Deserialize(reqData);
            BigInteger puzzleId = (BigInteger)req[0];
            UInt160 creator = (UInt160)req[1];
            BigInteger prize = (BigInteger)req[2];

            if (success && result != null)
            {
                object[] rngResult = (object[])StdLib.Deserialize(result);
                BigInteger treasureX = (BigInteger)rngResult[0] % GRID_SIZE;
                BigInteger treasureY = (BigInteger)rngResult[1] % GRID_SIZE;

                FogPuzzleData puzzle = new FogPuzzleData
                {
                    Creator = creator,
                    Prize = prize,
                    TreasureX = treasureX,
                    TreasureY = treasureY,
                    RevealCount = 0,
                    Solved = false,
                    Winner = UInt160.Zero
                };
                StorePuzzle(puzzleId, puzzle);
                OnPuzzleStarted(puzzleId, creator);
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Internal Helpers

        private static void StorePuzzle(BigInteger puzzleId, FogPuzzleData puzzle)
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
