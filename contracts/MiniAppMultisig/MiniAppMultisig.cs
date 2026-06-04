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
    /// <summary>
    /// MiniAppMultisig — on-chain M-of-N approval registry.
    ///
    /// WHY THIS DESIGN: the dApi wallet layer (OneGate/NeoLine signMessage) cannot
    /// produce the raw secp256r1 witness a native Neo `CheckMultisig` script needs,
    /// so collecting partial witnesses client-side is impossible. Instead each
    /// signer approves with a NORMAL single-signature wallet invocation of
    /// Approve(...), which the contract authenticates with Runtime.CheckWitness.
    /// The contract records approvals and fires RequestApproved once the threshold
    /// is reached — verifiable on-chain M-of-N consensus over an intent hash.
    ///
    /// This contract holds NO funds (no OnNEP17Payment): it is a pure approval
    /// ledger, so there is no custody/fund-loss surface. Execution of the approved
    /// intent is left to the consumer once the on-chain Approved status is reached.
    ///
    /// SECURITY:
    /// - Only a listed signer can approve (CheckWitness), once, while Pending.
    /// - Only the creator can cancel, while Pending.
    /// - Signer set is fixed at creation; duplicates rejected; 2..16 signers.
    /// - Threshold is 1..signerCount.
    /// </summary>
    [DisplayName("MiniAppMultisig")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "On-chain M-of-N approval registry: each signer approves via a normal single-sig invoke; threshold consensus is recorded on-chain.")]
    [ContractPermission("*", "*")]
    public class MiniAppMultisig : SmartContract
    {
        #region Constants
        private const int MIN_SIGNERS = 2;
        private const int MAX_SIGNERS = 16;
        private const int MAX_MEMO_LENGTH = 160;

        private const byte STATUS_PENDING = 0;
        private const byte STATUS_APPROVED = 1;
        private const byte STATUS_CANCELLED = 2;
        #endregion

        #region Storage Prefixes
        /// <summary>0x10: BigInteger counter of the last request id.</summary>
        private static readonly byte[] PREFIX_REQUEST_ID = new byte[] { 0x10 };
        /// <summary>0x11 + reqId: serialized MultisigRequest.</summary>
        private static readonly byte[] PREFIX_REQUEST = new byte[] { 0x11 };
        /// <summary>0x12 + reqId + signer: 1 if that signer has approved.</summary>
        private static readonly byte[] PREFIX_APPROVED = new byte[] { 0x12 };
        #endregion

        #region Events
        [DisplayName("RequestCreated")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, ByteString> OnRequestCreated;

        [DisplayName("Approved")]
        public static event Action<BigInteger, UInt160, BigInteger> OnApproved;

        [DisplayName("RequestApproved")]
        public static event Action<BigInteger> OnRequestApproved;

        [DisplayName("RequestCancelled")]
        public static event Action<BigInteger> OnRequestCancelled;
        #endregion

        #region Types
        public struct MultisigRequest
        {
            public UInt160 Creator;
            public BigInteger Threshold;
            public BigInteger ApprovalCount;
            public BigInteger Status;
            public BigInteger CreatedTime;
            public ByteString IntentHash;
            public string Memo;
            public UInt160[] Signers;
        }
        #endregion

        #region Mutating methods
        /// <summary>
        /// Create an approval request. The caller (creator) must witness the call.
        /// signers must contain 2..16 distinct addresses; threshold in 1..signers.
        /// intentHash is an opaque 32-byte hash of the action the signers approve.
        /// </summary>
        public static BigInteger CreateRequest(
            UInt160 creator,
            UInt160[] signers,
            BigInteger threshold,
            ByteString intentHash,
            string memo)
        {
            ExecutionEngine.Assert(creator is not null && creator.IsValid && !creator.IsZero, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "creator witness required");
            ExecutionEngine.Assert(signers is not null, "signers required");

            int count = signers.Length;
            ExecutionEngine.Assert(count >= MIN_SIGNERS && count <= MAX_SIGNERS, "signer count out of range");
            ExecutionEngine.Assert(threshold >= 1 && threshold <= count, "invalid threshold");
            ExecutionEngine.Assert(memo is null || memo.Length <= MAX_MEMO_LENGTH, "memo too long");

            // Validate each signer and reject duplicates.
            for (int i = 0; i < count; i++)
            {
                UInt160 s = signers[i];
                ExecutionEngine.Assert(s is not null && s.IsValid && !s.IsZero, "invalid signer");
                for (int j = i + 1; j < count; j++)
                {
                    ExecutionEngine.Assert(s != signers[j], "duplicate signer");
                }
            }

            StorageContext ctx = Storage.CurrentContext;
            BigInteger reqId = (BigInteger)Storage.Get(ctx, PREFIX_REQUEST_ID) + 1;
            Storage.Put(ctx, PREFIX_REQUEST_ID, reqId);

            MultisigRequest request = new MultisigRequest
            {
                Creator = creator,
                Threshold = threshold,
                ApprovalCount = 0,
                Status = STATUS_PENDING,
                CreatedTime = Runtime.Time,
                IntentHash = intentHash ?? (ByteString)"",
                Memo = memo ?? "",
                Signers = signers,
            };
            Storage.Put(ctx, RequestKey(reqId), StdLib.Serialize(request));

            OnRequestCreated(reqId, creator, threshold, count, request.IntentHash);
            return reqId;
        }

        /// <summary>
        /// Approve a pending request as one of its signers. The signer must witness
        /// the call (their own single-sig wallet), be a listed signer, and not have
        /// approved already. When the approval count reaches the threshold the
        /// request transitions to Approved and RequestApproved fires.
        /// </summary>
        public static void Approve(BigInteger requestId, UInt160 signer)
        {
            ExecutionEngine.Assert(signer is not null && signer.IsValid && !signer.IsZero, "invalid signer");
            ExecutionEngine.Assert(Runtime.CheckWitness(signer), "signer witness required");

            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, RequestKey(requestId));
            ExecutionEngine.Assert(raw is not null, "request not found");

            MultisigRequest request = (MultisigRequest)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(request.Status == STATUS_PENDING, "request not pending");
            ExecutionEngine.Assert(IsListedSigner(request, signer), "not a signer");

            byte[] approvedKey = ApprovedKey(requestId, signer);
            ExecutionEngine.Assert(Storage.Get(ctx, approvedKey) is null, "already approved");
            Storage.Put(ctx, approvedKey, 1);

            request.ApprovalCount += 1;
            if (request.ApprovalCount >= request.Threshold)
            {
                request.Status = STATUS_APPROVED;
            }
            Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));

            OnApproved(requestId, signer, request.ApprovalCount);
            if (request.Status == STATUS_APPROVED)
            {
                OnRequestApproved(requestId);
            }
        }

        /// <summary>Cancel a still-pending request. Only the creator may cancel.</summary>
        public static void Cancel(BigInteger requestId, UInt160 caller)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "caller witness required");

            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, RequestKey(requestId));
            ExecutionEngine.Assert(raw is not null, "request not found");

            MultisigRequest request = (MultisigRequest)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(request.Status == STATUS_PENDING, "request not pending");
            ExecutionEngine.Assert(request.Creator == caller, "only creator can cancel");

            request.Status = STATUS_CANCELLED;
            Storage.Put(ctx, RequestKey(requestId), StdLib.Serialize(request));
            OnRequestCancelled(requestId);
        }
        #endregion

        #region Read-only methods
        [Safe]
        public static BigInteger LastRequestId()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_REQUEST_ID);
        }

        [Safe]
        public static Map<string, object> GetRequest(BigInteger requestId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, RequestKey(requestId));
            ExecutionEngine.Assert(raw is not null, "request not found");
            MultisigRequest request = (MultisigRequest)StdLib.Deserialize(raw);

            Map<string, object> result = new Map<string, object>();
            result["id"] = requestId;
            result["creator"] = request.Creator;
            result["threshold"] = request.Threshold;
            result["approvalCount"] = request.ApprovalCount;
            result["status"] = request.Status;
            result["createdTime"] = request.CreatedTime;
            result["intentHash"] = request.IntentHash;
            result["memo"] = request.Memo;
            result["signers"] = request.Signers;
            return result;
        }

        [Safe]
        public static bool HasApproved(BigInteger requestId, UInt160 signer)
        {
            return Storage.Get(Storage.CurrentContext, ApprovedKey(requestId, signer)) is not null;
        }

        [Safe]
        public static bool IsSigner(BigInteger requestId, UInt160 signer)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, RequestKey(requestId));
            if (raw is null) return false;
            MultisigRequest request = (MultisigRequest)StdLib.Deserialize(raw);
            return IsListedSigner(request, signer);
        }
        #endregion

        #region Internal helpers
        private static byte[] RequestKey(BigInteger requestId)
        {
            return Helper.Concat(PREFIX_REQUEST, (byte[])(ByteString)requestId);
        }

        private static byte[] ApprovedKey(BigInteger requestId, UInt160 signer)
        {
            return Helper.Concat(Helper.Concat(PREFIX_APPROVED, (byte[])(ByteString)requestId), (byte[])signer);
        }

        private static bool IsListedSigner(MultisigRequest request, UInt160 signer)
        {
            UInt160[] signers = request.Signers;
            for (int i = 0; i < signers.Length; i++)
            {
                if (signers[i] == signer) return true;
            }
            return false;
        }
        #endregion
    }
}
