using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Gift Methods

        /// <summary>
        /// Gift a capsule to another user.
        /// </summary>
        public static void GiftCapsule(BigInteger capsuleId, UInt160 newOwner, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            CapsuleData capsule = GetCapsuleData(capsuleId);
            ExecutionEngine.Assert(capsule.Owner != UInt160.Zero, "capsule not found");
            ExecutionEngine.Assert(!capsule.IsRevealed, "already revealed");
            ExecutionEngine.Assert(capsule.Owner != newOwner, "cannot gift to self");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "not owner");
            ValidateAddress(newOwner);

            ValidatePaymentReceipt(APP_ID, capsule.Owner, GIFT_FEE, receiptId);

            UInt160 previousOwner = capsule.Owner;

            capsule.Owner = newOwner;
            capsule.IsGifted = true;
            StoreCapsule(capsuleId, capsule);

            RemoveUserCapsule(previousOwner, capsuleId);
            AddUserCapsule(newOwner, capsuleId);

            BigInteger totalGifted = TotalGifted();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_GIFTED, totalGifted + 1);

            UpdateUserStatsOnGift(previousOwner, GIFT_FEE);
            UpdateUserStatsOnReceive(newOwner);
            OnCapsuleGifted(capsuleId, previousOwner, newOwner);
        }

        #endregion

        #region Admin Methods

        /// <summary>
        /// Allow admin to withdraw collected fees.
        /// </summary>
        public static void WithdrawFees(UInt160 recipient, BigInteger amount)
        {
            ValidateAdmin();
            ValidateAddress(recipient);
            ExecutionEngine.Assert(amount > 0, "amount must be positive");

            BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");

            bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, recipient, amount);
            ExecutionEngine.Assert(transferred, "withdraw failed");
        }

        #endregion
    }
}
