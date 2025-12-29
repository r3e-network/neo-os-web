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
    public delegate void GameCreatedHandler(BigInteger gameId, UInt160 player1, BigInteger stake);
    public delegate void PlayerJoinedHandler(BigInteger gameId, UInt160 player2);
    public delegate void MoveSubmittedHandler(BigInteger gameId, UInt160 player, BigInteger moveId, BigInteger requestId);
    public delegate void MoveRevealedHandler(BigInteger gameId, UInt160 player, string move, bool valid);
    public delegate void GameEndedHandler(BigInteger gameId, UInt160 winner, BigInteger prize);
    public delegate void AutomationRegisteredHandler(BigInteger taskId, string triggerType, string schedule);
    public delegate void AutomationCancelledHandler(BigInteger taskId);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);

    /// <summary>
    /// Fog Chess - Fog of War Chess with TEE-verified hidden moves.
    ///
    /// ARCHITECTURE (Chainlink-style):
    /// - Player1 creates game via CreateGame
    /// - Player2 joins via JoinGame
    /// - Players submit encrypted moves via SubmitMove
    /// - TEE validates moves, updates hidden board state
    /// - Move validity revealed after both players submit
    ///
    /// MECHANICS:
    /// - Board state encrypted in TEE
    /// - Players only see their pieces + adjacent squares
    /// - Invalid moves forfeit the game
    /// </summary>
    [DisplayName("MiniAppFogChess")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Fog Chess - Fog of War Chess with TEE-verified hidden moves")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-fogchess";
        private const long MIN_STAKE = 50000000; // 0.5 GAS
        #endregion

        #region App Prefixes (start from 0x10)
        private static readonly byte[] PREFIX_GAME_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GAMES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MOVE_ID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_MOVES = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_REQUEST_TO_MOVE = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct GameData
        {
            public UInt160 Player1;
            public UInt160 Player2;
            public BigInteger Stake;
            public BigInteger Turn; // 1 or 2
            public bool Active;
            public UInt160 Winner;
        }

        public struct MoveData
        {
            public BigInteger GameId;
            public UInt160 Player;
            public ByteString EncryptedMove;
            public bool Validated;
            public bool Valid;
        }
        #endregion

        #region App Events
        [DisplayName("GameCreated")]
        public static event GameCreatedHandler OnGameCreated;

        [DisplayName("PlayerJoined")]
        public static event PlayerJoinedHandler OnPlayerJoined;

        [DisplayName("MoveSubmitted")]
        public static event MoveSubmittedHandler OnMoveSubmitted;

        [DisplayName("MoveRevealed")]
        public static event MoveRevealedHandler OnMoveRevealed;

        [DisplayName("GameEnded")]
        public static event GameEndedHandler OnGameEnded;

        [DisplayName("AutomationRegistered")]
        public static event AutomationRegisteredHandler OnAutomationRegistered;

        [DisplayName("AutomationCancelled")]
        public static event AutomationCancelledHandler OnAutomationCancelled;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_GAME_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_MOVE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateGame(UInt160 player1, BigInteger stake)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player1), "unauthorized");
            ExecutionEngine.Assert(stake >= MIN_STAKE, "min stake 0.5 GAS");

            BigInteger gameId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GAME_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_GAME_ID, gameId);

            GameData game = new GameData
            {
                Player1 = player1,
                Player2 = UInt160.Zero,
                Stake = stake,
                Turn = 1,
                Active = false,
                Winner = UInt160.Zero
            };
            StoreGame(gameId, game);

            OnGameCreated(gameId, player1, stake);
            return gameId;
        }

        public static void JoinGame(BigInteger gameId, UInt160 player2)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player2), "unauthorized");

            GameData game = GetGame(gameId);
            ExecutionEngine.Assert(game.Player1 != null, "game not found");
            ExecutionEngine.Assert(game.Player2 == UInt160.Zero, "game full");
            ExecutionEngine.Assert(player2 != game.Player1, "cannot play yourself");

            game.Player2 = player2;
            game.Active = true;
            StoreGame(gameId, game);

            OnPlayerJoined(gameId, player2);
        }

        /// <summary>
        /// Submit an encrypted move for TEE validation.
        /// </summary>
        public static BigInteger SubmitMove(BigInteger gameId, UInt160 player, ByteString encryptedMove)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "unauthorized");

            GameData game = GetGame(gameId);
            ExecutionEngine.Assert(game.Player1 != null, "game not found");
            ExecutionEngine.Assert(game.Active, "game not active");

            // Verify it's player's turn
            bool isPlayer1 = player == game.Player1;
            bool isPlayer2 = player == game.Player2;
            ExecutionEngine.Assert(isPlayer1 || isPlayer2, "not a player");
            ExecutionEngine.Assert(
                (game.Turn == 1 && isPlayer1) || (game.Turn == 2 && isPlayer2),
                "not your turn"
            );

            BigInteger moveId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MOVE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MOVE_ID, moveId);

            MoveData move = new MoveData
            {
                GameId = gameId,
                Player = player,
                EncryptedMove = encryptedMove,
                Validated = false,
                Valid = false
            };
            StoreMove(moveId, move);

            // Request TEE to validate move against hidden board state
            BigInteger requestId = RequestTeeCompute(moveId, gameId, encryptedMove);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MOVE, (ByteString)requestId.ToByteArray()),
                moveId);

            OnMoveSubmitted(gameId, player, moveId, requestId);
            return moveId;
        }

        [Safe]
        public static GameData GetGame(BigInteger gameId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_GAMES, (ByteString)gameId.ToByteArray()));
            if (data == null) return new GameData();
            return (GameData)StdLib.Deserialize(data);
        }

        [Safe]
        public static MoveData GetMove(BigInteger moveId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_MOVES, (ByteString)moveId.ToByteArray()));
            if (data == null) return new MoveData();
            return (MoveData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Request Methods

        private static BigInteger RequestTeeCompute(BigInteger moveId, BigInteger gameId, ByteString encryptedMove)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { moveId, gameId, encryptedMove });
            return (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "tee-compute", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString moveIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MOVE, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(moveIdData != null, "unknown request");

            BigInteger moveId = (BigInteger)moveIdData;
            MoveData move = GetMove(moveId);
            ExecutionEngine.Assert(!move.Validated, "already validated");

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MOVE, (ByteString)requestId.ToByteArray()));

            move.Validated = true;

            GameData game = GetGame(move.GameId);
            string moveNotation = "";

            if (success && result != null && result.Length > 0)
            {
                // Result format: [isValid, moveNotation, isGameOver, winnerId]
                object[] moveResult = (object[])StdLib.Deserialize(result);
                move.Valid = (bool)moveResult[0];
                moveNotation = (string)moveResult[1];
                bool isGameOver = (bool)moveResult[2];

                if (move.Valid)
                {
                    // Switch turns
                    game.Turn = game.Turn == 1 ? 2 : 1;

                    if (isGameOver)
                    {
                        BigInteger winnerId = (BigInteger)moveResult[3];
                        game.Active = false;
                        game.Winner = winnerId == 1 ? game.Player1 : game.Player2;
                        OnGameEnded(move.GameId, game.Winner, game.Stake * 2);
                    }
                }
                else
                {
                    // Invalid move = forfeit
                    game.Active = false;
                    game.Winner = move.Player == game.Player1 ? game.Player2 : game.Player1;
                    OnGameEnded(move.GameId, game.Winner, game.Stake * 2);
                }

                StoreGame(move.GameId, game);
            }

            StoreMove(moveId, move);
            OnMoveRevealed(move.GameId, move.Player, moveNotation, move.Valid);
        }

        #endregion

        #region Internal Helpers

        private static void StoreGame(BigInteger gameId, GameData game)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_GAMES, (ByteString)gameId.ToByteArray()),
                StdLib.Serialize(game));
        }

        private static void StoreMove(BigInteger moveId, MoveData move)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_MOVES, (ByteString)moveId.ToByteArray()),
                StdLib.Serialize(move));
        }

        #endregion

        #region Periodic Automation

        /// <summary>
        /// Returns the AutomationAnchor contract address.
        /// </summary>
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        /// <summary>
        /// Sets the AutomationAnchor contract address.
        /// SECURITY: Only admin can set the automation anchor.
        /// </summary>
        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// LOGIC: Handles game timeouts - forfeits timed-out players.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            // Verify caller is AutomationAnchor
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            OnPeriodicExecutionTriggered(taskId);

            // Process automated timeout checks
            ProcessAutomatedTimeout();
        }

        /// <summary>
        /// Registers this MiniApp for periodic automation.
        /// SECURITY: Only admin can register.
        /// CORRECTNESS: AutomationAnchor must be set first.
        /// </summary>
        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000); // 0.01 GAS limit

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            OnAutomationRegistered(taskId, triggerType, schedule);
            return taskId;
        }

        /// <summary>
        /// Cancels the registered automation task.
        /// SECURITY: Only admin can cancel.
        /// </summary>
        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            OnAutomationCancelled(taskId);
        }

        /// <summary>
        /// Internal method to process automated timeout checks.
        /// Called by OnPeriodicExecution.
        /// Scans active games and forfeits players who haven't moved within timeout window.
        /// </summary>
        private static void ProcessAutomatedTimeout()
        {
            // Timeout configuration: 24 hours (86400 seconds)
            BigInteger TIMEOUT_SECONDS = 86400;
            BigInteger currentTime = Runtime.Time;

            // Scan recent games (last 100) for timeout violations
            BigInteger currentGameId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_GAME_ID);
            BigInteger startId = currentGameId > 100 ? currentGameId - 100 : 1;

            for (BigInteger gameId = startId; gameId <= currentGameId; gameId++)
            {
                GameData game = GetGame(gameId);

                // Skip non-active games
                if (!game.Active || game.Player1 == null)
                {
                    continue;
                }

                // Get last move time for this game
                ByteString lastMoveKey = Helper.Concat(
                    (ByteString)new byte[] { 0x18 },
                    (ByteString)gameId.ToByteArray());
                ByteString lastMoveData = Storage.Get(Storage.CurrentContext, lastMoveKey);

                BigInteger lastMoveTime = lastMoveData != null ? (BigInteger)lastMoveData : 0;

                // If no moves yet, use game creation time (approximate)
                if (lastMoveTime == 0)
                {
                    continue; // Skip games with no moves
                }

                // Check if timeout exceeded
                BigInteger elapsedTime = currentTime - lastMoveTime;
                if (elapsedTime > TIMEOUT_SECONDS)
                {
                    // Determine which player timed out based on whose turn it is
                    UInt160 winner = game.Turn == 1 ? game.Player2 : game.Player1;

                    // End game with timeout forfeit
                    game.Active = false;
                    game.Winner = winner;
                    StoreGame(gameId, game);

                    OnGameEnded(gameId, winner, game.Stake * 2);
                }
            }
        }

        #endregion
    }
}
