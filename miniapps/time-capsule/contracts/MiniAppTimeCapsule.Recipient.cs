using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Recipient and Gift Methods

        /// <summary>
        /// Add a designated recipient to a private capsule.
        /// </summary>
        public static void AddRecipient(BigInteger capsuleId, UInt160 recipient)
        {
            ValidateNotGloballyPaused(APP_ID);

            CapsuleData capsule = GetCapsuleData(capsuleId);
            ExecutionEngine.Assert(capsule.Owner != UInt160.Zero, "capsule not found");
            ExecutionEngine.Assert(!capsule.IsPublic, "public capsules don't need recipients");
            ExecutionEngine.Assert(!capsule.IsRevealed, "already revealed");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "not owner");
            ValidateAddress(recipient);

            ExecutionEngine.Assert(!IsRecipient(capsuleId, recipient), "already recipient");

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_RECIPIENTS, (ByteString)capsuleId.ToByteArray()),
                recipient);
            Storage.Put(Storage.CurrentContext, key, 1);

            byte[] countKey = Helper.Concat(PREFIX_RECIPIENT_COUNT, (ByteString)capsuleId.ToByteArray());
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            capsule.RecipientCount = count + 1;
            StoreCapsule(capsuleId, capsule);

            OnRecipientAdded(capsuleId, recipient);
        }

        /// <summary>
        /// Extend the unlock time of a capsule.
        /// </summary>
        public static void ExtendUnlockTime(BigInteger capsuleId, BigInteger newUnlockTime, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            CapsuleData capsule = GetCapsuleData(capsuleId);
            ExecutionEngine.Assert(capsule.Owner != UInt160.Zero, "capsule not found");
            ExecutionEngine.Assert(!capsule.IsRevealed, "already revealed");
            ExecutionEngine.Assert(newUnlockTime > capsule.UnlockTime, "must extend time");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "not owner");

            BigInteger newDuration = newUnlockTime - capsule.CreateTime;
            ExecutionEngine.Assert(newDuration <= MAX_LOCK_DURATION_SECONDS, "exceeds max duration");

            ValidatePaymentReceipt(APP_ID, capsule.Owner, EXTEND_FEE, receiptId);

            capsule.UnlockTime = newUnlockTime;
            capsule.ExtensionCount += 1;
            StoreCapsule(capsuleId, capsule);

            SetUnlockTime(capsuleId, newUnlockTime);
            UpdateUserStatsOnExtend(capsule.Owner, EXTEND_FEE);
            OnCapsuleExtended(capsuleId, newUnlockTime);

        }

        #endregion
    }
}
