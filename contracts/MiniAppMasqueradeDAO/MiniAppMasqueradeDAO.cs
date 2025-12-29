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
    public delegate void MaskCreatedHandler(BigInteger maskId, UInt160 owner);
    public delegate void VoteSubmittedHandler(BigInteger proposalId, BigInteger maskId);
    public delegate void IdentityRevealedHandler(BigInteger maskId, UInt160 realIdentity);

    /// <summary>
    /// MasqueradeDAO MiniApp - Anonymous DAO voting with mask identities.
    /// TEE ensures vote privacy while preventing double voting.
    /// </summary>
    [DisplayName("MiniAppMasqueradeDAO")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Masquerade DAO - Anonymous governance")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-masqueradedao";
        private const long MASK_FEE = 10000000; // 0.1 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_MASK_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MASKS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_PROPOSALS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_VOTES = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct MaskData
        {
            public ByteString IdentityHash;
            public BigInteger CreateTime;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("MaskCreated")]
        public static event MaskCreatedHandler OnMaskCreated;

        [DisplayName("VoteSubmitted")]
        public static event VoteSubmittedHandler OnVoteSubmitted;

        [DisplayName("IdentityRevealed")]
        public static event IdentityRevealedHandler OnIdentityRevealed;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_MASK_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateMask(UInt160 owner, ByteString identityHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(identityHash.Length == 32, "invalid hash");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, owner, MASK_FEE, receiptId);

            BigInteger maskId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MASK_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MASK_ID, maskId);

            MaskData mask = new MaskData
            {
                IdentityHash = identityHash,
                CreateTime = Runtime.Time,
                Active = true
            };
            StoreMask(maskId, mask);

            OnMaskCreated(maskId, owner);
            return maskId;
        }

        public static void SubmitVote(BigInteger proposalId, BigInteger maskId, BigInteger choice, ByteString proof)
        {
            ValidateNotGloballyPaused(APP_ID);

            MaskData mask = GetMask(maskId);
            ExecutionEngine.Assert(mask.Active, "mask not active");

            ByteString voteKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTES, (ByteString)proposalId.ToByteArray()),
                (ByteString)maskId.ToByteArray());
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, voteKey) == null, "already voted");

            Storage.Put(Storage.CurrentContext, voteKey, choice);
            OnVoteSubmitted(proposalId, maskId);
        }

        [Safe]
        public static MaskData GetMask(BigInteger maskId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MASKS, (ByteString)maskId.ToByteArray()));
            if (data == null) return new MaskData();
            return (MaskData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreMask(BigInteger maskId, MaskData mask)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MASKS, (ByteString)maskId.ToByteArray()),
                StdLib.Serialize(mask));
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
