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
    public delegate void ScriptUploadedHandler(UInt160 player, BigInteger scriptId, string scriptHash);
    public delegate void MatchStartedHandler(BigInteger matchId, BigInteger script1, BigInteger script2);
    public delegate void MatchEndedHandler(BigInteger matchId, BigInteger winner, int score1, int score2);

    /// <summary>
    /// Algo Battle Arena - Code gladiator battles in TEE.
    ///
    /// GAME MECHANICS:
    /// - Players upload battle scripts (JS/Lua strategies)
    /// - Scripts are stored encrypted, executed in TEE
    /// - Matches run 100 rounds, only results visible
    /// - Ladder ranking based on wins
    /// </summary>
    [DisplayName("MiniAppAlgoBattle")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. AlgoBattle is a competitive programming application for algorithm battles. Use it to upload battle scripts and compete, you can climb the ladder rankings with TEE-verified match results.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-algo-battle";
        private const int PLATFORM_FEE_PERCENT = 10;
        private const long UPLOAD_FEE = 10000000; // 0.1 GAS
        private const long MATCH_FEE = 50000000; // 0.5 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_SCRIPT_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_SCRIPT_OWNER = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_SCRIPT_HASH = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_SCRIPT_WINS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_SCRIPT_LOSSES = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_MATCH_ID = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_MATCH_DATA = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_REQUEST_TO_MATCH = new byte[] { 0x17 };
        #endregion

        #region Events
        [DisplayName("ScriptUploaded")]
        public static event ScriptUploadedHandler OnScriptUploaded;

        [DisplayName("MatchStarted")]
        public static event MatchStartedHandler OnMatchStarted;

        [DisplayName("MatchEnded")]
        public static event MatchEndedHandler OnMatchEnded;
        #endregion

        #region Getters
        [Safe]
        public static BigInteger TotalScripts() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SCRIPT_ID);

        [Safe]
        public static BigInteger TotalMatches() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MATCH_ID);

        [Safe]
        public static BigInteger ScriptWins(BigInteger scriptId)
        {
            byte[] key = Helper.Concat(PREFIX_SCRIPT_WINS, (ByteString)scriptId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger ScriptLosses(BigInteger scriptId)
        {
            byte[] key = Helper.Concat(PREFIX_SCRIPT_LOSSES, (ByteString)scriptId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_MATCH_ID, 0);
        }
        #endregion

        #region User Methods

        /// <summary>
        /// Upload a new battle script.
        /// </summary>
        public static void UploadScript(UInt160 player, string scriptHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, UPLOAD_FEE, receiptId);

            BigInteger scriptId = TotalScripts() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ID, scriptId);

            byte[] ownerKey = Helper.Concat(PREFIX_SCRIPT_OWNER, (ByteString)scriptId.ToByteArray());
            Storage.Put(Storage.CurrentContext, ownerKey, player);

            byte[] hashKey = Helper.Concat(PREFIX_SCRIPT_HASH, (ByteString)scriptId.ToByteArray());
            Storage.Put(Storage.CurrentContext, hashKey, scriptHash);

            OnScriptUploaded(player, scriptId, scriptHash);
        }

        /// <summary>
        /// Request a match against another script.
        /// </summary>
        public static void RequestMatch(UInt160 player, BigInteger myScriptId, BigInteger opponentScriptId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            byte[] ownerKey = Helper.Concat(PREFIX_SCRIPT_OWNER, (ByteString)myScriptId.ToByteArray());
            UInt160 owner = (UInt160)Storage.Get(Storage.CurrentContext, ownerKey);
            ExecutionEngine.Assert(owner == player, "not script owner");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, MATCH_FEE, receiptId);

            BigInteger matchId = TotalMatches() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MATCH_ID, matchId);

            // Store match data
            byte[] matchKey = Helper.Concat(PREFIX_MATCH_DATA, (ByteString)matchId.ToByteArray());
            Storage.Put(Storage.CurrentContext, matchKey, StdLib.Serialize(new object[] { myScriptId, opponentScriptId }));

            // Request compute service for battle
            RequestBattleCompute(matchId, myScriptId, opponentScriptId);

            OnMatchStarted(matchId, myScriptId, opponentScriptId);
        }

        #endregion

        #region Service Callbacks

        private static void RequestBattleCompute(BigInteger matchId, BigInteger script1, BigInteger script2)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { matchId, script1, script2 });
            BigInteger requestId = (BigInteger)Contract.Call(
                gateway, "requestService", CallFlags.All,
                APP_ID, "compute", payload,
                Runtime.ExecutingScriptHash, "onServiceCallback"
            );

            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MATCH, (ByteString)requestId.ToByteArray()),
                matchId);
        }

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString matchIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MATCH, (ByteString)requestId.ToByteArray()));
            ExecutionEngine.Assert(matchIdData != null, "unknown request");

            BigInteger matchId = (BigInteger)matchIdData;

            byte[] matchKey = Helper.Concat(PREFIX_MATCH_DATA, (ByteString)matchId.ToByteArray());
            object[] matchData = (object[])StdLib.Deserialize(Storage.Get(Storage.CurrentContext, matchKey));
            BigInteger script1 = (BigInteger)matchData[0];
            BigInteger script2 = (BigInteger)matchData[1];

            if (!success)
            {
                OnMatchEnded(matchId, 0, 0, 0);
                return;
            }

            // Parse battle result
            object[] battleResult = (object[])StdLib.Deserialize(result);
            int score1 = (int)(BigInteger)battleResult[0];
            int score2 = (int)(BigInteger)battleResult[1];

            BigInteger winner = score1 > score2 ? script1 : (score2 > score1 ? script2 : 0);

            // Update stats
            if (winner == script1)
            {
                IncrementStat(PREFIX_SCRIPT_WINS, script1);
                IncrementStat(PREFIX_SCRIPT_LOSSES, script2);

                // SECURITY FIX: Transfer reward to winner
                byte[] winnerOwnerKey = Helper.Concat(PREFIX_SCRIPT_OWNER, (ByteString)script1.ToByteArray());
                UInt160 winnerOwner = (UInt160)Storage.Get(Storage.CurrentContext, winnerOwnerKey);
                BigInteger reward = MATCH_FEE * (100 - PLATFORM_FEE_PERCENT) / 100;
                if (winnerOwner != null && winnerOwner.IsValid && reward > 0)
                {
                    GAS.Transfer(Runtime.ExecutingScriptHash, winnerOwner, reward);
                }
            }
            else if (winner == script2)
            {
                IncrementStat(PREFIX_SCRIPT_WINS, script2);
                IncrementStat(PREFIX_SCRIPT_LOSSES, script1);

                // SECURITY FIX: Transfer reward to winner
                byte[] winnerOwnerKey = Helper.Concat(PREFIX_SCRIPT_OWNER, (ByteString)script2.ToByteArray());
                UInt160 winnerOwner = (UInt160)Storage.Get(Storage.CurrentContext, winnerOwnerKey);
                BigInteger reward = MATCH_FEE * (100 - PLATFORM_FEE_PERCENT) / 100;
                if (winnerOwner != null && winnerOwner.IsValid && reward > 0)
                {
                    GAS.Transfer(Runtime.ExecutingScriptHash, winnerOwner, reward);
                }
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_MATCH, (ByteString)requestId.ToByteArray()));

            OnMatchEnded(matchId, winner, score1, score2);
        }

        private static void IncrementStat(byte[] prefix, BigInteger scriptId)
        {
            byte[] key = Helper.Concat(prefix, (ByteString)scriptId.ToByteArray());
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, current + 1);
        }

        #endregion
    }
}
