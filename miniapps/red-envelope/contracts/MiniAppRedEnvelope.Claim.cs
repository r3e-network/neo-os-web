using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Claim Methods

        /// <summary>
        /// Claim a packet from an envelope.
        /// </summary>
        public static BigInteger Claim(BigInteger envelopeId, UInt160 claimer)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            EnvelopeData envelope = GetEnvelope(envelopeId);
            ExecutionEngine.Assert(envelope.Creator != null, "envelope not found");
            ExecutionEngine.Assert(envelope.Ready, "envelope not ready");
            ExecutionEngine.Assert(envelope.ClaimedCount < envelope.PacketCount, "envelope empty");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)envelope.ExpiryTime, "envelope expired");

            ByteString grabberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_GRABBER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])claimer);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, grabberKey) == null, "already claimed");

            UserStats claimerStats = GetUserStats(claimer);
            bool isNewClaimer = claimerStats.JoinTime == 0;

            BigInteger claimIndex = envelope.ClaimedCount + 1;
            BigInteger amount = GetPacketAmount(envelopeId, claimIndex);

            // Lazy Settlement Fallback: If amount not in storage, calculate on-the-fly
            if (amount == 0)
            {
                amount = CalculatePacketAmount(envelopeId, claimIndex);
            }
            ExecutionEngine.Assert(amount > 0, "invalid packet amount");

            Storage.Put(Storage.CurrentContext, grabberKey, amount);

            envelope.ClaimedCount = claimIndex;
            envelope.RemainingAmount = envelope.RemainingAmount - amount;

            bool isBestLuck = amount > envelope.BestLuckAmount;
            if (isBestLuck)
            {
                envelope.BestLuckAddress = claimer;
                envelope.BestLuckAmount = amount;
            }

            StoreEnvelope(envelopeId, envelope);
            UpdateClaimerStats(claimer, amount, isNewClaimer);



            BigInteger remaining = envelope.PacketCount - envelope.ClaimedCount;
            OnEnvelopeClaimed(envelopeId, claimer, amount, remaining);

            if (remaining == 0)
            {
                if (envelope.BestLuckAddress != UInt160.Zero)
                {
                    UpdateBestLuckWinner(envelope.BestLuckAddress, envelopeId);
                }
                
                // Cleanup seed as no more packets can be claimed
                DeleteOperationSeed(envelopeId);
                
                OnEnvelopeCompleted(envelopeId, envelope.BestLuckAddress, envelope.BestLuckAmount);
            }

            return amount;
        }

        [Safe]
        public static bool HasClaimed(BigInteger envelopeId, UInt160 claimer)
        {
            ByteString grabberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_GRABBER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])claimer);
            return Storage.Get(Storage.CurrentContext, grabberKey) != null;
        }

        [Safe]
        public static BigInteger GetPacketAmount(BigInteger envelopeId, BigInteger index)
        {
            ByteString amountKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_AMOUNTS, (ByteString)envelopeId.ToByteArray()),
                (ByteString)index.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, amountKey);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        [Safe]
        public static BigInteger GetClaimedAmount(BigInteger envelopeId, UInt160 claimer)
        {
            ByteString grabberKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_GRABBER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])claimer);
            ByteString data = Storage.Get(Storage.CurrentContext, grabberKey);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        #endregion
    }
}
