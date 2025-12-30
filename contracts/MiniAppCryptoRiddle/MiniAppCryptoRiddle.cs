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
    public delegate void RiddleCreatedHandler(BigInteger riddleId, UInt160 creator, BigInteger reward);
    public delegate void AttemptMadeHandler(BigInteger riddleId, UInt160 solver, bool correct);
    public delegate void RiddleSolvedHandler(BigInteger riddleId, UInt160 winner, BigInteger reward);

    /// <summary>
    /// CryptoRiddle MiniApp - Password-protected red envelopes with riddles.
    /// Solve the riddle to claim the GAS reward.
    /// </summary>
    [DisplayName("MiniAppCryptoRiddle")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. CryptoRiddle is a puzzle gaming application for password-protected rewards. Use it to create or solve riddles, you can claim GAS rewards by cracking the correct answers.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-cryptoriddle";
        private const long MIN_REWARD = 10000000; // 0.1 GAS
        private const long ATTEMPT_FEE = 1000000; // 0.01 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_RIDDLE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_RIDDLES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct RiddleData
        {
            public UInt160 Creator;
            public string Hint;
            public ByteString AnswerHash;
            public BigInteger Reward;
            public BigInteger AttemptCount;
            public bool Solved;
            public UInt160 Winner;
            public BigInteger CreateTime;
        }
        #endregion

        #region App Events
        [DisplayName("RiddleCreated")]
        public static event RiddleCreatedHandler OnRiddleCreated;

        [DisplayName("AttemptMade")]
        public static event AttemptMadeHandler OnAttemptMade;

        [DisplayName("RiddleSolved")]
        public static event RiddleSolvedHandler OnRiddleSolved;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_RIDDLE_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateRiddle(UInt160 creator, string hint, ByteString answerHash, BigInteger reward, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(reward >= MIN_REWARD, "min 0.1 GAS");
            ExecutionEngine.Assert(hint.Length <= 200, "hint too long");
            ExecutionEngine.Assert(answerHash.Length == 32, "invalid hash");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, reward, receiptId);

            BigInteger riddleId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RIDDLE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_RIDDLE_ID, riddleId);

            RiddleData riddle = new RiddleData
            {
                Creator = creator,
                Hint = hint,
                AnswerHash = answerHash,
                Reward = reward,
                AttemptCount = 0,
                Solved = false,
                Winner = UInt160.Zero,
                CreateTime = Runtime.Time
            };
            StoreRiddle(riddleId, riddle);

            OnRiddleCreated(riddleId, creator, reward);
            return riddleId;
        }

        public static bool SolveRiddle(BigInteger riddleId, UInt160 solver, string answer, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            RiddleData riddle = GetRiddle(riddleId);
            ExecutionEngine.Assert(!riddle.Solved, "already solved");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(solver), "unauthorized");

            ValidatePaymentReceipt(APP_ID, solver, ATTEMPT_FEE, receiptId);

            riddle.AttemptCount += 1;
            riddle.Reward += ATTEMPT_FEE;

            ByteString attemptHash = CryptoLib.Sha256(answer);
            bool correct = attemptHash == riddle.AnswerHash;

            if (correct)
            {
                riddle.Solved = true;
                riddle.Winner = solver;
                OnRiddleSolved(riddleId, solver, riddle.Reward);
            }

            StoreRiddle(riddleId, riddle);
            OnAttemptMade(riddleId, solver, correct);
            return correct;
        }

        [Safe]
        public static RiddleData GetRiddle(BigInteger riddleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_RIDDLES, (ByteString)riddleId.ToByteArray()));
            if (data == null) return new RiddleData();
            return (RiddleData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreRiddle(BigInteger riddleId, RiddleData riddle)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_RIDDLES, (ByteString)riddleId.ToByteArray()),
                StdLib.Serialize(riddle));
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
