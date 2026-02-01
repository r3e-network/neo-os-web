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
            ExecutionEngine.Assert((BigInteger)Runtime.Time >= capsule.UnlockTime, "not unlocked yet");

            bool isOwner = revealer == capsule.Owner;
            bool canReveal = isOwner || capsule.IsPublic || IsRecipient(capsuleId, revealer);
            ExecutionEngine.Assert(canReveal, "not authorized to reveal");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(revealer), "unauthorized");

            capsule.IsRevealed = true;
            capsule.Revealer = revealer;
            capsule.RevealTime = (BigInteger)Runtime.Time;
            StoreCapsule(capsuleId, capsule);

            BigInteger totalRevealed = TotalRevealed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REVEALED, totalRevealed + 1);

            MarkRevealed(capsuleId, revealer);
            UpdateUserStatsOnReveal(revealer);
            OnCapsuleRevealed(capsuleId, revealer, capsule.ContentHash);

        }

        /// <summary>
        /// Fish for a random public capsule that is unlocked.
        /// This uses a bounded on-chain scan (up to 50). Off-chain indexing is recommended at scale.
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

            BigInteger startId = ((BigInteger)Runtime.Time % total) + 1;
            BigInteger foundCapsuleId = 0;

            for (BigInteger i = 0; i < total && i < 50; i++)
            {
                BigInteger checkId = ((startId + i - 1) % total) + 1;
                CapsuleData capsule = GetCapsuleData(checkId);

                if (capsule.IsPublic && !capsule.IsRevealed && (BigInteger)Runtime.Time >= capsule.UnlockTime)
                {
                    foundCapsuleId = checkId;
                    break;
                }
            }

            ExecutionEngine.Assert(foundCapsuleId > 0, "no fishable capsule found");

            BigInteger totalFished = TotalFished();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FISHED, totalFished + 1);

            BigInteger rewardPaid = 0;
            if (FISH_REWARD > 0)
            {
                BigInteger balance = GAS.BalanceOf(Runtime.ExecutingScriptHash);
                if (balance >= FISH_REWARD)
                {
                    bool rewarded = GAS.Transfer(Runtime.ExecutingScriptHash, fisher, FISH_REWARD);
                    ExecutionEngine.Assert(rewarded, "reward transfer failed");
                    rewardPaid = FISH_REWARD;
                }
            }

            UpdateUserStatsOnFish(fisher, FISH_FEE, rewardPaid);
            OnCapsuleFished(fisher, foundCapsuleId, rewardPaid);

            return foundCapsuleId;
        }

        #endregion
    }
}
