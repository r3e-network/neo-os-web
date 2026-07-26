using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        // ===================================================================
        // RedEnvelope logic -- ported from MiniAppRedEnvelope
        // ===================================================================

        #region Envelope Methods

        /// <summary>
        /// Create a red envelope funded by the creator's prepaid GAS credit.
        /// Packet amounts are computed on-chain using a deterministic split so
        /// claiming does not depend on an external RNG oracle.
        /// </summary>
        public static BigInteger CreateEnvelope(
            string appId,
            UInt160 creator,
            BigInteger packetCount,
            BigInteger expiryMs)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");

            // Read the creator's GAS credit balance as the envelope amount
            BigInteger totalAmount = GetGasCreditBalance(appId, creator);

            ExecutionEngine.Assert(totalAmount >= MIN_ENVELOPE_AMOUNT, "min 0.1 GAS");
            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "1-100 packets");
            ExecutionEngine.Assert(totalAmount >= packetCount * MIN_PER_PACKET, "min 0.01 GAS per packet");
            // expiryMs is the lifetime in milliseconds (Runtime.Time is ms on Neo N3).
            ExecutionEngine.Assert(expiryMs > 0, "expiry required");

            ConsumeGasCredit(appId, creator, totalAmount);

            // Increment envelope counter for this app
            ByteString idKey = AppKey(appId, PREFIX_ENVELOPE_ID);
            BigInteger envelopeId = GetBigInteger(idKey) + 1;
            Put(idKey, envelopeId);

            EnvelopeData envelope = new EnvelopeData
            {
                Creator = creator,
                TotalAmount = totalAmount,
                PacketCount = packetCount,
                ClaimedCount = 0,
                RemainingAmount = totalAmount,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                ExpiryTime = Runtime.Time + (ulong)expiryMs
            };
            StoreEnvelope(appId, envelopeId, envelope);

            // Audit fix M-4: packet amounts are NO LONGER pre-computed and stored in plaintext.
            // Doing so let claimers read the upcoming packet sizes and race/front-run the large
            // ones, defeating the random split. Each packet is now drawn at CLAIM time from a
            // bounded distribution seeded by the consensus beacon (unknown until the claim tx
            // mines) and bound to the claimer (see NextEnvelopePacketAmount), so amounts are
            // unpredictable and not observable in advance. The split still guarantees every
            // packet >= MIN_PER_PACKET and distributes the pool exactly.

            OnEnvelopeCreated(appId, envelopeId, creator, totalAmount, packetCount);
            return envelopeId;
        }

        /// <summary>
        /// Claim a single packet from an envelope.
        /// </summary>
        public static BigInteger ClaimEnvelope(string appId, BigInteger envelopeId, UInt160 claimer)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            EnvelopeData envelope = GetEnvelope(appId, envelopeId);
            // UInt160.Zero fix: ensure Creator was actually stored
            ExecutionEngine.Assert(envelope.Creator != UInt160.Zero, "envelope not found");
            ExecutionEngine.Assert(envelope.ClaimedCount < envelope.PacketCount, "envelope empty");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)envelope.ExpiryTime, "envelope expired");

            // Duplicate claim check
            ByteString grabberKey = AppKey(appId, PREFIX_GRABBER, envelopeId, claimer);
            ExecutionEngine.Assert(GetRaw(grabberKey) == null, "already claimed");

            BigInteger claimIndex = envelope.ClaimedCount + 1;
            // The packet amount is drawn here at claim time from a bounded distribution
            // (see NextEnvelopePacketAmount). This is grinding-resistant but not
            // grinding-proof — a claimer could abort/retry to nudge toward a larger
            // packet — and the entropy source is NOT VRF-grade. The draw is capped and
            // always reserves MIN_PER_PACKET for every later packet, so this only
            // matters for low-stakes social envelopes and is an accepted design choice.
            BigInteger amount = NextEnvelopePacketAmount(envelope, claimIndex, envelopeId, claimer);
            ExecutionEngine.Assert(amount > 0, "invalid packet amount");

            AcquireSocialLock();
            // Mark claimed
            Put(grabberKey, amount);

            // Update envelope state
            envelope.ClaimedCount = claimIndex;
            envelope.RemainingAmount -= amount;

            if (amount > envelope.BestLuckAmount)
            {
                envelope.BestLuckAddress = claimer;
                envelope.BestLuckAmount = amount;
            }
            StoreEnvelope(appId, envelopeId, envelope);

            // Transfer GAS to claimer
            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount),
                "claim payout failed");
            EnsureGasCreditSolvent();
            ReleaseSocialLock();

            BigInteger remaining = envelope.PacketCount - envelope.ClaimedCount;
            OnEnvelopeClaimed(appId, envelopeId, claimer, amount, remaining);

            if (remaining == 0)
            {
                OnEnvelopeCompleted(appId, envelopeId, envelope.BestLuckAddress, envelope.BestLuckAmount);
            }

            return amount;
        }

        /// <summary>
        /// Creator reclaims unclaimed GAS from an expired envelope. CreateEnvelope
        /// consumed the creator's full GAS credit, and ClaimEnvelope rejects after
        /// ExpiryTime — without this method the unclaimed RemainingAmount would be
        /// locked in the contract forever. Refund is gated on:
        ///   • envelope exists
        ///   • caller is the original creator (witness)
        ///   • envelope has actually expired (Runtime.Time > ExpiryTime)
        ///   • RemainingAmount > 0
        /// </summary>
        public static BigInteger RefundExpiredEnvelope(string appId, BigInteger envelopeId)
        {
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);

            EnvelopeData envelope = GetEnvelope(appId, envelopeId);
            ExecutionEngine.Assert(envelope.Creator != UInt160.Zero, "envelope not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(envelope.Creator), "only creator");
            ExecutionEngine.Assert(Runtime.Time > (ulong)envelope.ExpiryTime, "not expired yet");
            ExecutionEngine.Assert(envelope.RemainingAmount > 0, "nothing to refund");

            BigInteger refund = envelope.RemainingAmount;

            // Zero out the remaining amount BEFORE transferring (checks-effects-
            // interactions). Also mark every unclaimed packet as consumed by setting
            // ClaimedCount to PacketCount so a follow-up ClaimEnvelope would short-
            // circuit on "envelope empty".
            envelope.RemainingAmount = 0;
            envelope.ClaimedCount = envelope.PacketCount;
            AcquireSocialLock();
            StoreEnvelope(appId, envelopeId, envelope);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, envelope.Creator, refund),
                "refund transfer failed");
            EnsureGasCreditSolvent();
            ReleaseSocialLock();

            OnEnvelopeRefunded(appId, envelopeId, envelope.Creator, refund);
            return refund;
        }

        #endregion
    }
}
