using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Reveal and Fish Methods

        /// <summary>
        /// Reveal capsule content (only after unlock time).
        /// </summary>
        public static void Reveal(UInt160 revealer, BigInteger capsuleId)
        {
            ValidateNotGloballyPaused(APP_ID);

            CapsuleData capsule = GetCapsuleData(capsuleId);
            ExecutionEngine.Assert(capsule.Owner != UInt160.Zero, "capsule not found");
            ExecutionEngine.Assert(!capsule.IsRevealed, "already revealed");
            ExecutionEngine.Assert(Runtime.Time >= capsule.UnlockTime, "not unlocked yet");

            bool isOwner = revealer == capsule.Owner;
            bool canReveal = isOwner || capsule.IsPublic || IsRecipient(capsuleId, revealer);
            ExecutionEngine.Assert(canReveal, "not authorized to reveal");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(revealer), "unauthorized");

            capsule.IsRevealed = true;
            capsule.Revealer = revealer;
            capsule.RevealTime = Runtime.Time;
            StoreCapsule(capsuleId, capsule);

            BigInteger totalRevealed = TotalRevealed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REVEALED, totalRevealed + 1);

            UpdateUserStatsOnReveal(revealer);
            MarkRevealed(capsuleId, revealer);

            OnCapsuleRevealed(capsuleId, revealer, capsule.ContentHash);
        }

        /// <summary>
        /// [DEPRECATED] O(n) capsule search - use FishWithId instead.
        /// Frontend searches off-chain using GetCapsuleFishStatus(), then calls FishWithId().
        /// Fish for a random public capsule that is unlocked.
        /// </summary>
        public static BigInteger Fish(UInt160 fisher, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(fisher), "unauthorized");

            ValidatePaymentReceipt(APP_ID, fisher, FISH_FEE, receiptId);

            BigInteger total = TotalCapsules();
            ExecutionEngine.Assert(total > 0, "no capsules");

            BigInteger startId = (Runtime.Time % total) + 1;
            BigInteger foundCapsuleId = 0;

            for (BigInteger i = 0; i < total && i < 50; i++)
            {
                BigInteger checkId = ((startId + i - 1) % total) + 1;
                CapsuleData capsule = GetCapsuleData(checkId);

                if (capsule.IsPublic && !capsule.IsRevealed && Runtime.Time >= capsule.UnlockTime)
                {
                    foundCapsuleId = checkId;
                    break;
                }
            }

            ExecutionEngine.Assert(foundCapsuleId > 0, "no fishable capsule found");

            BigInteger totalFished = TotalFished();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FISHED, totalFished + 1);

            UpdateUserStatsOnFish(fisher);

            OnCapsuleFished(fisher, foundCapsuleId, FISH_REWARD);
            return foundCapsuleId;
        }

        #endregion
    }
}
