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
    public delegate void ReadingRequestedHandler(BigInteger readingId, UInt160 user, string question);
    public delegate void ReadingCompletedHandler(BigInteger readingId, UInt160 user, BigInteger[] cards);
    public delegate void ReadingRevealedHandler(BigInteger readingId, string interpretation);

    /// <summary>
    /// OnChainTarot MiniApp - Blockchain fortune telling with verifiable randomness.
    /// TEE generates card draws, interpretations stored on-chain for transparency.
    /// </summary>
    [DisplayName("MiniAppOnChainTarot")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. OnChainTarot is a fortune telling application for verifiable readings. Use it to request tarot card draws, you can receive transparent interpretations with provably random card selection.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-onchaintarot";
        private const long READING_FEE = 5000000; // 0.05 GAS
        private const int TOTAL_CARDS = 78;
        private const int CARDS_PER_READING = 3;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_READING_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_READINGS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_REQUEST_MAP = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct ReadingData
        {
            public UInt160 User;
            public string Question;
            public BigInteger[] Cards;
            public bool Completed;
            public BigInteger Timestamp;
        }
        #endregion

        #region App Events
        [DisplayName("ReadingRequested")]
        public static event ReadingRequestedHandler OnReadingRequested;

        [DisplayName("ReadingCompleted")]
        public static event ReadingCompletedHandler OnReadingCompleted;

        [DisplayName("ReadingRevealed")]
        public static event ReadingRevealedHandler OnReadingRevealed;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger RequestReading(UInt160 user, string question, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(question.Length > 0 && question.Length <= 200, "invalid question");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

            ValidatePaymentReceipt(APP_ID, user, READING_FEE, receiptId);

            BigInteger readingId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_READING_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_READING_ID, readingId);

            ReadingData reading = new ReadingData
            {
                User = user,
                Question = question,
                Cards = new BigInteger[0],
                Completed = false,
                Timestamp = Runtime.Time
            };
            StoreReading(readingId, reading);

            BigInteger requestId = RequestRng(readingId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()),
                readingId);

            OnReadingRequested(readingId, user, question);
            return readingId;
        }

        [Safe]
        public static ReadingData GetReading(BigInteger readingId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READINGS, (ByteString)readingId.ToByteArray()));
            if (data == null) return new ReadingData();
            return (ReadingData)StdLib.Deserialize(data);
        }

        #endregion

        #region Service Callbacks

        private static BigInteger RequestRng(BigInteger readingId)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            ByteString payload = StdLib.Serialize(new object[] { readingId, CARDS_PER_READING });
            return (BigInteger)Contract.Call(gateway, "requestService", CallFlags.All,
                APP_ID, "rng", payload, Runtime.ExecutingScriptHash, "onServiceCallback");
        }

        public static void OnServiceCallback(BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString readingIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
            if (readingIdData == null) return;

            BigInteger readingId = (BigInteger)readingIdData;
            ReadingData reading = GetReading(readingId);

            if (success && result != null)
            {
                object[] rngResult = (object[])StdLib.Deserialize(result);
                BigInteger[] cards = new BigInteger[CARDS_PER_READING];
                for (int i = 0; i < CARDS_PER_READING; i++)
                {
                    cards[i] = (BigInteger)rngResult[i] % TOTAL_CARDS;
                }
                reading.Cards = cards;
                reading.Completed = true;
                StoreReading(readingId, reading);
                OnReadingCompleted(readingId, reading.User, cards);
            }

            Storage.Delete(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REQUEST_MAP, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Internal Helpers

        private static void StoreReading(BigInteger readingId, ReadingData reading)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_READINGS, (ByteString)readingId.ToByteArray()),
                StdLib.Serialize(reading));
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
