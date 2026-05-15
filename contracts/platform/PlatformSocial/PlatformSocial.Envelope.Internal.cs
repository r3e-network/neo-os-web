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
