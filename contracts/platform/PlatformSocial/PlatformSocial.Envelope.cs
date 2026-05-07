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
        /// Create a GAS reward pool where each claimer receives a random amount
        /// inside [minClaimAmount, maxClaimAmount]. The total amount is funded
        /// from the creator's prepaid GAS credit, and the pool is scoped to the
        /// appId so multiple MiniApps can share the same PlatformSocial contract.
        /// </summary>
        public static BigInteger CreateRangeGasPool(
            string appId,
            UInt160 creator,
            BigInteger totalAmount,
            BigInteger minClaimAmount,
            BigInteger maxClaimAmount,
            BigInteger maxClaims,
            BigInteger expirySeconds)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(totalAmount >= MIN_RANGE_POOL_AMOUNT, "min 0.1 GAS");
            ExecutionEngine.Assert(minClaimAmount > 0, "min claim required");
            ExecutionEngine.Assert(minClaimAmount <= maxClaimAmount, "invalid claim range");
            ExecutionEngine.Assert(maxClaims > 0 && maxClaims <= MAX_PACKETS, "1-100 claims");
            ExecutionEngine.Assert(expirySeconds > 0, "expiry required");
            ExecutionEngine.Assert(totalAmount >= minClaimAmount * maxClaims, "pool below minimum claims");
            ExecutionEngine.Assert(totalAmount <= maxClaimAmount * maxClaims, "pool exceeds maximum claims");

            ConsumeGasCredit(creator, totalAmount);

            ByteString idKey = AppKey(appId, PREFIX_RANGE_POOL_ID);
            BigInteger poolId = GetBigInteger(idKey) + 1;
            Put(idKey, poolId);

            RangeGasPoolData pool = new RangeGasPoolData
            {
                Creator = creator,
                TotalAmount = totalAmount,
                MinClaimAmount = minClaimAmount,
                MaxClaimAmount = maxClaimAmount,
                MaxClaims = maxClaims,
                ClaimedCount = 0,
                RemainingAmount = totalAmount,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                ExpiryTime = Runtime.Time + (ulong)expirySeconds,
                Active = true
            };
            StoreRangeGasPool(appId, poolId, pool);

            OnRangeGasPoolCreated(appId, poolId, creator, totalAmount, minClaimAmount, maxClaimAmount, maxClaims);
            return poolId;
        }

        /// <summary>
        /// Claim once from a bounded GAS reward pool.
        /// </summary>
        public static BigInteger ClaimRangeGasPool(string appId, BigInteger poolId, UInt160 claimer)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");
            ExecutionEngine.Assert(claimer != UInt160.Zero && claimer.IsValid, "invalid claimer");

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.Active, "pool inactive");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)pool.ExpiryTime, "pool expired");
            ExecutionEngine.Assert(pool.ClaimedCount < pool.MaxClaims, "pool empty");

            ByteString claimerKey = AppKey(appId, PREFIX_RANGE_CLAIMER, poolId, claimer);
            ExecutionEngine.Assert(GetRaw(claimerKey) == null, "already claimed");

            BigInteger amount = NextRangeGasPoolAmount(pool, poolId, claimer);
            ExecutionEngine.Assert(amount >= pool.MinClaimAmount, "claim below minimum");
            ExecutionEngine.Assert(amount <= pool.MaxClaimAmount, "claim above maximum");
            ExecutionEngine.Assert(amount <= pool.RemainingAmount, "insufficient pool");

            Put(claimerKey, amount);

            pool.ClaimedCount += 1;
            pool.RemainingAmount -= amount;
            if (amount > pool.BestLuckAmount)
            {
                pool.BestLuckAddress = claimer;
                pool.BestLuckAmount = amount;
            }

            BigInteger remainingClaims = pool.MaxClaims - pool.ClaimedCount;
            if (remainingClaims == 0)
            {
                ExecutionEngine.Assert(pool.RemainingAmount == 0, "pool remainder invalid");
                pool.Active = false;
            }

            StoreRangeGasPool(appId, poolId, pool);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount),
                "claim payout failed");

            OnRangeGasPoolClaimed(appId, poolId, claimer, amount, pool.RemainingAmount, remainingClaims);
            if (remainingClaims == 0)
            {
                OnRangeGasPoolCompleted(appId, poolId, pool.BestLuckAddress, pool.BestLuckAmount);
            }

            return amount;
        }

        /// <summary>
        /// Add more GAS to an active range reward pool. Only the original pool
        /// creator can top up, and the added amount must still fit within the
        /// remaining maximum payout capacity for unclaimed slots.
        /// </summary>
        public static BigInteger FundRangeGasPool(string appId, BigInteger poolId, UInt160 creator, BigInteger amount)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);
            ExecutionEngine.Assert(creator != UInt160.Zero && creator.IsValid, "invalid creator");
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(pool.Creator == creator, "creator mismatch");
            ExecutionEngine.Assert(pool.Active, "pool inactive");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)pool.ExpiryTime, "pool expired");
            ExecutionEngine.Assert(pool.ClaimedCount < pool.MaxClaims, "pool empty");

            BigInteger remainingClaims = pool.MaxClaims - pool.ClaimedCount;
            BigInteger maxRemainingCapacity = remainingClaims * pool.MaxClaimAmount;
            ExecutionEngine.Assert(pool.RemainingAmount + amount <= maxRemainingCapacity, "pool exceeds maximum claims");

            ConsumeGasCredit(creator, amount);

            pool.TotalAmount += amount;
            pool.RemainingAmount += amount;
            StoreRangeGasPool(appId, poolId, pool);

            OnRangeGasPoolFunded(appId, poolId, creator, amount, pool.TotalAmount, pool.RemainingAmount);
            return pool.RemainingAmount;
        }

        /// <summary>
        /// Refund remaining GAS after a pool expires or completes with leftover
        /// balance. Only the pool creator can refund.
        /// </summary>
        public static BigInteger RefundRangeGasPool(string appId, BigInteger poolId)
        {
            ValidateAppNotPaused(appId);
            ValidateAppRegistered(appId, APP_TYPE_ENVELOPE);

            RangeGasPoolData pool = GetRangeGasPool(appId, poolId);
            ExecutionEngine.Assert(pool.Creator != UInt160.Zero, "pool not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(pool.Creator), "unauthorized");
            ExecutionEngine.Assert(pool.RemainingAmount > 0, "nothing to refund");
            ExecutionEngine.Assert(Runtime.Time > (ulong)pool.ExpiryTime || !pool.Active, "pool still active");

            BigInteger refund = pool.RemainingAmount;
            pool.RemainingAmount = 0;
            pool.Active = false;
            StoreRangeGasPool(appId, poolId, pool);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, pool.Creator, refund),
                "refund failed");

            OnRangeGasPoolRefunded(appId, poolId, pool.Creator, refund);
            return refund;
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

        /// <summary>
        /// Read range GAS pool state.
        /// </summary>
        [Safe]
        public static RangeGasPoolData GetRangeGasPool(string appId, BigInteger poolId)
        {
            ByteString data = GetRaw(AppKey(appId, PREFIX_RANGE_POOLS, poolId));
            if (data == null) return new RangeGasPoolData();
            return (RangeGasPoolData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Check whether a claimer already claimed from the range GAS pool.
        /// </summary>
        [Safe]
        public static bool HasClaimedRangeGasPool(string appId, BigInteger poolId, UInt160 claimer)
        {
            return GetRaw(AppKey(appId, PREFIX_RANGE_CLAIMER, poolId, claimer)) != null;
        }

        #endregion

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
