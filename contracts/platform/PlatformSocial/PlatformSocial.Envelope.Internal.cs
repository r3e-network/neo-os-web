using System;
using System.ComponentModel;
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
        #region Envelope Internal Helpers

        private static void StoreEnvelope(string appId, BigInteger envelopeId, EnvelopeData envelope)
        {
            Put(AppKey(appId, PREFIX_ENVELOPES, envelopeId), StdLib.Serialize(envelope));
        }

        private static void StoreRangeGasPool(string appId, BigInteger poolId, RangeGasPoolData pool)
        {
            Put(AppKey(appId, PREFIX_RANGE_POOLS, poolId), StdLib.Serialize(pool));
        }

        private static BigInteger NextRangeGasPoolAmount(RangeGasPoolData pool, BigInteger poolId, UInt160 claimer)
        {
            BigInteger claimsLeftAfterThis = pool.MaxClaims - pool.ClaimedCount - 1;
            BigInteger minReserve = claimsLeftAfterThis * pool.MinClaimAmount;
            BigInteger maxReserve = claimsLeftAfterThis * pool.MaxClaimAmount;
            BigInteger lowerBound = Max(pool.MinClaimAmount, pool.RemainingAmount - maxReserve);
            BigInteger upperBound = Min(pool.MaxClaimAmount, pool.RemainingAmount - minReserve);

            ExecutionEngine.Assert(lowerBound <= upperBound, "invalid claim bounds");
            BigInteger range = upperBound - lowerBound;
            if (range == 0) return lowerBound;

            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            entropy += RandomChunk((byte[])claimer, poolId + pool.ClaimedCount + Runtime.Time);
            return lowerBound + (entropy % (range + 1));
        }

        private static BigInteger Min(BigInteger a, BigInteger b) => a < b ? a : b;

        private static BigInteger Max(BigInteger a, BigInteger b) => a > b ? a : b;

        /// <summary>
        /// Draws this claim's packet amount at CLAIM time (audit fix M-4) so packet sizes are
        /// never stored or observable in advance. Mirrors the range-gas-pool algorithm: the last
        /// packet takes the exact remainder; earlier packets draw a bounded random amount that
        /// always leaves MIN_PER_PACKET for every still-unclaimed packet. Entropy combines the
        /// per-block consensus beacon (Runtime.GetRandom(), unknown until the tx mines) with the
        /// claimer address, so the result cannot be predicted or front-run and differs per claimer
        /// within the same block. `envelope` is the pre-claim state (ClaimedCount/RemainingAmount
        /// not yet updated); claimIndex == ClaimedCount + 1.
        ///
        /// LIMITATION (acknowledged, low severity): because the amount is drawn at claim time,
        /// the draw is grinding-resistant but not grinding-proof — a claimer could abort and retry
        /// across blocks to nudge toward a larger packet. The outcome is bounded (the upper bound
        /// keeps MIN_PER_PACKET reserved for every still-unclaimed packet), so grinding cannot
        /// drain the envelope or starve later claimers; it only shifts one share toward its capped
        /// maximum at the cost of extra fees and blocks. Runtime.GetRandom() is NOT VRF-grade; this
        /// is intended for low-stakes social envelopes only. A commit/reveal scheme would remove the
        /// residual bias but require a second transaction per claim, degrading the social-gifting
        /// UX, so it is intentionally not used.
        /// </summary>
        private static BigInteger NextEnvelopePacketAmount(EnvelopeData envelope, BigInteger claimIndex, BigInteger envelopeId, UInt160 claimer)
        {
            // Final packet: exact remainder keeps the pool perfectly distributed.
            if (claimIndex >= envelope.PacketCount)
            {
                return envelope.RemainingAmount;
            }

            BigInteger packetsLeftAfterThis = envelope.PacketCount - claimIndex; // >= 1
            BigInteger minReserve = packetsLeftAfterThis * MIN_PER_PACKET;
            BigInteger maxForThis = envelope.RemainingAmount - minReserve;
            ExecutionEngine.Assert(maxForThis >= MIN_PER_PACKET, "invalid packet bounds");

            BigInteger lowerBound = MIN_PER_PACKET;
            BigInteger range = maxForThis - lowerBound;
            if (range <= 0) return lowerBound;

            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            entropy += RandomChunk((byte[])claimer, envelopeId + envelope.ClaimedCount + Runtime.Time);
            return lowerBound + (entropy % (range + 1));
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
