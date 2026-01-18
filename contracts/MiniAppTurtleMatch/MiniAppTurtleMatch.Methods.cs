using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTurtleMatch
    {
        #region Internal Helpers
        private static BigInteger GetNextSessionId()
        {
            BigInteger id = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SESSION_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SESSION_ID, id);
            return id;
        }

        private static void IncrementStat(byte[] prefix, BigInteger amount)
        {
            BigInteger total = (BigInteger)Storage.Get(Storage.CurrentContext, prefix) + amount;
            Storage.Put(Storage.CurrentContext, prefix, total);
        }
        #endregion

        #region Game Methods
        /// <summary>
        /// Start a new game session by purchasing blindboxes.
        /// Hybrid Architecture: Register operation with deterministic seed.
        /// Flow: StartGame (on-chain) → Frontend calculates using seed → SettleGame (on-chain verifies)
        /// </summary>
        public static BigInteger StartGame(UInt160 player, BigInteger boxCount, BigInteger receiptId)
        {
            // Authorization check
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "Not authorized");

            // Validate box count
            ExecutionEngine.Assert(boxCount >= MIN_BLINDBOXES && boxCount <= MAX_BLINDBOXES, "Invalid box count");

            // Calculate payment
            BigInteger payment = boxCount * BLINDBOX_PRICE;
            ValidatePaymentReceipt(APP_ID, player, payment, receiptId);

            // Register bet and validate limits (MiniAppGameComputeBase)
            ValidateGameBetLimits(player, payment);
            RecordGameBet(player, payment);
            
            // Get Session ID (used as Operation ID)
            BigInteger sessionId = GetNextSessionId();

            // Generate deterministic seed using standard Method (stores seed for verification)
            ByteString seed = GenerateOperationSeed(sessionId, player, SCRIPT_MATCH_LOGIC);

            // Create session (initial state only)
            GameSession session = new GameSession
            {
                SessionId = sessionId,
                Player = player,
                BoxCount = boxCount,
                Seed = seed,
                Payment = payment,
                StartTime = Runtime.Time,
                Settled = false,
                TotalMatches = 0,
                TotalReward = 0,
                SettleTime = 0
            };

            // Save session
            SaveSession(session);
            AddPlayerSession(player, sessionId);

            // Update stats
            IncrementStat(PREFIX_TOTAL_SESSIONS, 1);
            IncrementStat(PREFIX_TOTAL_BOXES, boxCount);

            // Emit event with seed for frontend calculation
            OnGameStarted(player, sessionId, boxCount, (string)seed);

            return sessionId;
        }

        /// <summary>
        /// Settle game with verified results.
        /// Hybrid Architecture: Verifies results deterministically against stored seed.
        /// Requires the caller to provide valid script hash matching registered TEE logic.
        /// </summary>
        public static bool SettleGame(
            UInt160 player,
            BigInteger sessionId,
            BigInteger totalMatches,
            BigInteger totalReward,
            ByteString scriptHash)
        {
            // Authorization check
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "Not authorized");
            
            // Verify script is registered (Standard Compliance)
            ValidateScriptHash(SCRIPT_MATCH_LOGIC, scriptHash);

            // Get session
            GameSession session = GetSession(sessionId);
            ExecutionEngine.Assert(session.SessionId == sessionId, "Session not found");
            ExecutionEngine.Assert(session.Player == player, "Not session owner");
            ExecutionEngine.Assert(!session.Settled, "Already settled");

            // Get stored seed (Standard Compliance)
            ByteString storedSeed = GetOperationSeed(sessionId);
            // If storedSeed is null (generic helper failure), fallback to session seed (legacy compatibility)
            // But prefer storedSeed to ensure GenerateOperationSeed was used.
            if (storedSeed == null) storedSeed = session.Seed;
            ExecutionEngine.Assert(storedSeed != null, "Fatal: Seed lost");

            // DATA INTEGRITY CHECK: calculated vs claimed
            (BigInteger calcMatches, BigInteger calcReward) = CalculateGameResult(session.BoxCount, storedSeed);
            
            ExecutionEngine.Assert(calcMatches == totalMatches, "Invalid result: matches mismatch");
            ExecutionEngine.Assert(calcReward == totalReward, "Invalid result: reward mismatch");

            // Cleanup seed (Standard Compliance)
            DeleteOperationSeed(sessionId);

            // Update session with final state
            session.Settled = true;
            session.TotalMatches = totalMatches;
            session.TotalReward = totalReward;
            session.SettleTime = Runtime.Time;
            SaveSession(session);

            // Update platform stats
            IncrementStat(PREFIX_TOTAL_MATCHES, totalMatches);
            IncrementStat(PREFIX_TOTAL_PAID, totalReward);

            // Pay reward if any
            if (totalReward > 0)
            {
                PayReward(player, totalReward);
            }

            // Emit event
            OnGameSettled(player, sessionId, totalMatches, totalReward);

            return true;
        }
        #endregion
    }
}
