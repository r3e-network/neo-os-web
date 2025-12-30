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
    public delegate void NotePlayedHandler(BigInteger noteId, UInt160 player, BigInteger pitch);
    public delegate void MelodyCompletedHandler(BigInteger melodyId, BigInteger noteCount);
    public delegate void ComposerRewardedHandler(UInt160 composer, BigInteger reward);

    /// <summary>
    /// WorldPiano MiniApp - Global collaborative piano where anyone can play.
    /// Each note costs GAS, melodies are recorded on-chain forever.
    /// </summary>
    [DisplayName("MiniAppWorldPiano")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. WorldPiano is a collaborative music application for global composition. Use it to play notes on a shared piano, you can create permanent on-chain melodies with contributors worldwide.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-worldpiano";
        private const long NOTE_FEE = 1000000; // 0.01 GAS per note
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_NOTE_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_NOTES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MELODY_ID = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_MELODIES = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct NoteData
        {
            public UInt160 Player;
            public BigInteger Pitch;
            public BigInteger Duration;
            public BigInteger Timestamp;
        }
        #endregion

        #region App Events
        [DisplayName("NotePlayed")]
        public static event NotePlayedHandler OnNotePlayed;

        [DisplayName("MelodyCompleted")]
        public static event MelodyCompletedHandler OnMelodyCompleted;

        [DisplayName("ComposerRewarded")]
        public static event ComposerRewardedHandler OnComposerRewarded;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_NOTE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_MELODY_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger PlayNote(UInt160 player, BigInteger pitch, BigInteger duration, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(pitch >= 0 && pitch <= 127, "invalid pitch");
            ExecutionEngine.Assert(duration > 0 && duration <= 4000, "invalid duration");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ValidatePaymentReceipt(APP_ID, player, NOTE_FEE, receiptId);

            BigInteger noteId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_NOTE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_NOTE_ID, noteId);

            NoteData note = new NoteData
            {
                Player = player,
                Pitch = pitch,
                Duration = duration,
                Timestamp = Runtime.Time
            };
            StoreNote(noteId, note);

            OnNotePlayed(noteId, player, pitch);
            return noteId;
        }

        [Safe]
        public static NoteData GetNote(BigInteger noteId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_NOTES, (ByteString)noteId.ToByteArray()));
            if (data == null) return new NoteData();
            return (NoteData)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetTotalNotes()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_NOTE_ID);
        }

        #endregion

        #region Internal Helpers

        private static void StoreNote(BigInteger noteId, NoteData note)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_NOTES, (ByteString)noteId.ToByteArray()),
                StdLib.Serialize(note));
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
