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
            BigInteger expirySeconds)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");

            // Read the creator's GAS credit balance as the envelope amount
            StorageMap gasCredits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString creditKey = (ByteString)(byte[])creator;
            ByteString existing = gasCredits.Get(creditKey);
            BigInteger totalAmount = existing == null ? 0 : (BigInteger)existing;

            ExecutionEngine.Assert(totalAmount >= MIN_ENVELOPE_AMOUNT, "min 0.1 GAS");
            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "1-100 packets");
            ExecutionEngine.Assert(totalAmount >= packetCount * MIN_PER_PACKET, "min 0.01 GAS per packet");
            ExecutionEngine.Assert(expirySeconds > 0, "expiry required");

            ConsumeGasCredit(creator, totalAmount);

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
                ExpiryTime = Runtime.Time + (ulong)expirySeconds
            };
            StoreEnvelope(appId, envelopeId, envelope);

            // Pre-generate deterministic packet amounts using block-derived seed
            ByteString seed = CryptoLib.Sha256(
                Helper.Concat(
                    Helper.Concat((ByteString)envelopeId.ToByteArray(), (ByteString)(byte[])creator),
                    (ByteString)Runtime.Time.ToString()));
            StoreGeneratedAmounts(appId, envelopeId, totalAmount, packetCount, (byte[])seed);

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
            BigInteger amount = GetPacketAmount(appId, envelopeId, claimIndex);
            ExecutionEngine.Assert(amount > 0, "invalid packet amount");

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

            BigInteger remaining = envelope.PacketCount - envelope.ClaimedCount;
            OnEnvelopeClaimed(appId, envelopeId, claimer, amount, remaining);

            if (remaining == 0)
            {
                OnEnvelopeCompleted(appId, envelopeId, envelope.BestLuckAddress, envelope.BestLuckAmount);
            }

            return amount;
        }

        /// <summary>
        /// Read envelope state.
        /// </summary>
        [Safe]
        public static EnvelopeData GetEnvelope(string appId, BigInteger envelopeId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_ENVELOPES, envelopeId));
            if (data == null) return new EnvelopeData();
            return (EnvelopeData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check whether a claimer already grabbed from the envelope.
        /// </summary>
        [Safe]
        public static bool HasClaimed(string appId, BigInteger envelopeId, UInt160 claimer)
        {
            return GetRaw(AppKey(appId, PREFIX_GRABBER, envelopeId, claimer)) != null;
        }

        #endregion

        #region Envelope Internal Helpers

        private static void StoreEnvelope(string appId, BigInteger envelopeId, EnvelopeData envelope)
        {
            Put(AppKey(appId, PREFIX_ENVELOPES, envelopeId), StdLib.Serialize(envelope));
        }

        private static BigInteger GetPacketAmount(string appId, BigInteger envelopeId, BigInteger index)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_AMOUNTS, envelopeId, index));
            return data == null ? 0 : (BigInteger)data;
        }

        private static void StorePacketAmount(string appId, BigInteger envelopeId, BigInteger index, BigInteger amount)
        {
            Put(AppKey(appId, PREFIX_AMOUNTS, envelopeId, index), amount);
        }

        /// <summary>
        /// Deterministically split totalAmount into packetCount packets using
        /// randomBytes as entropy source. Same algorithm as original
        /// MiniAppRedEnvelope.StoreGeneratedAmounts.
        /// </summary>
        private static void StoreGeneratedAmounts(
            string appId,
            BigInteger envelopeId,
            BigInteger totalAmount,
            BigInteger packetCount,
            byte[] randomBytes)
        {
            ExecutionEngine.Assert(randomBytes != null && randomBytes.Length > 0, "seed bytes required");
            ExecutionEngine.Assert(packetCount > 0, "packet count required");

            BigInteger remaining = totalAmount;

            for (BigInteger i = 1; i < packetCount; i++)
            {
                BigInteger packetsLeft = packetCount - i + 1;
                BigInteger minRemaining = (packetsLeft - 1) * MIN_PER_PACKET;
                BigInteger maxForThis = remaining - minRemaining;
                ExecutionEngine.Assert(maxForThis >= MIN_PER_PACKET, "invalid packet bounds");

                BigInteger amount = MIN_PER_PACKET;
                BigInteger range = maxForThis - MIN_PER_PACKET;
                if (range > 0)
                {
                    amount += RandomChunk(randomBytes, i) % (range + 1);
                }

                StorePacketAmount(appId, envelopeId, i, amount);
                remaining -= amount;
            }

            // Last packet gets the remainder
            StorePacketAmount(appId, envelopeId, packetCount, remaining);
        }

        private static BigInteger RandomChunk(byte[] randomBytes, BigInteger index)
        {
            int length = randomBytes.Length;
            int offset = (int)((index * 4) % length);

            BigInteger value = randomBytes[offset];
            value = (value << 8) + randomBytes[(offset + 1) % length];
            value = (value << 8) + randomBytes[(offset + 2) % length];
            value = (value << 8) + randomBytes[(offset + 3) % length];
            return value;
        }

        #endregion
    }
}
