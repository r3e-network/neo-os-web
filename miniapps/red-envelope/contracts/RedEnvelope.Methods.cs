using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace RedEnvelope.Contract
{
    public partial class RedEnvelope
    {
        #region Spreading Envelope

        /// <summary>
        /// Open a spreading envelope NFT. Caller must be current NFT holder.
        /// </summary>
        public static BigInteger OpenEnvelope(BigInteger envelopeId, UInt160 opener)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(opener), "unauthorized");

            ByteString tokenId = (ByteString)envelopeId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            ExecutionEngine.Assert(token != null, "token not found");
            ExecutionEngine.Assert(token.EnvelopeType == ENVELOPE_TYPE_SPREADING, "not spreading envelope");

            UInt160 currentHolder = (UInt160)OwnerOf(tokenId);
            ExecutionEngine.Assert(currentHolder == opener, "not NFT holder");

            EnvelopeData envelope = GetEnvelopeData(envelopeId);
            ExecutionEngine.Assert(EnvelopeExists(envelope), "envelope not found");
            ExecutionEngine.Assert(envelope.EnvelopeType == ENVELOPE_TYPE_SPREADING, "invalid envelope type");
            ExecutionEngine.Assert(envelope.Active, "not active");
            ExecutionEngine.Assert(envelope.OpenedCount < envelope.PacketCount, "depleted");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)envelope.ExpiryTime, "expired");

            ByteString openerKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_OPENER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])opener);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, openerKey) == null, "already opened");

            ValidateNeoHolding(opener, envelope.MinNeoRequired, envelope.MinHoldSeconds);

            BigInteger packetIndex = envelope.OpenedCount;
            ByteString seed = GetSeed(envelopeId);
            ExecutionEngine.Assert(seed != null, "seed missing");
            BigInteger amount = CalculateSinglePacketAmount(
                envelope.TotalAmount,
                envelope.PacketCount,
                (byte[])seed,
                packetIndex);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            Storage.Put(Storage.CurrentContext, openerKey, amount);

            envelope.OpenedCount += 1;
            envelope.RemainingAmount -= amount;
            StoreEnvelopeData(envelopeId, envelope);

            GAS.Transfer(Runtime.ExecutingScriptHash, opener, amount);

            BigInteger remainingPackets = envelope.PacketCount - envelope.OpenedCount;
            OnEnvelopeOpened(envelopeId, opener, amount, remainingPackets);

            if (remainingPackets == 0)
            {
                envelope.Active = false;
                StoreEnvelopeData(envelopeId, envelope);

                Burn(tokenId);
                DeleteSeed(envelopeId);
                OnEnvelopeBurned(envelopeId, opener);
            }

            return amount;
        }

        public static BigInteger openEnvelope(BigInteger envelopeId, UInt160 opener)
        {
            return OpenEnvelope(envelopeId, opener);
        }

        /// <summary>
        /// Transfer spreading envelope NFT.
        /// </summary>
        public static void TransferEnvelope(BigInteger envelopeId, UInt160 from, UInt160 to, object data)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");

            ByteString tokenId = (ByteString)envelopeId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            ExecutionEngine.Assert(token != null, "token not found");
            ExecutionEngine.Assert(token.EnvelopeType == ENVELOPE_TYPE_SPREADING, "not spreading envelope");

            EnvelopeData envelope = GetEnvelopeData(envelopeId);
            ExecutionEngine.Assert(EnvelopeExists(envelope), "envelope not found");
            ExecutionEngine.Assert(envelope.Active, "not active");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)envelope.ExpiryTime, "expired");

            Transfer(from, to, 1, tokenId, data);
        }

        public static void transferEnvelope(BigInteger envelopeId, UInt160 from, UInt160 to, object data)
        {
            TransferEnvelope(envelopeId, from, to, data);
        }

        /// <summary>
        /// Creator reclaims unclaimed GAS from an expired spreading envelope.
        /// </summary>
        public static BigInteger ReclaimEnvelope(BigInteger envelopeId, UInt160 creator)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            EnvelopeData envelope = GetEnvelopeData(envelopeId);
            ExecutionEngine.Assert(EnvelopeExists(envelope), "envelope not found");
            ExecutionEngine.Assert(envelope.EnvelopeType == ENVELOPE_TYPE_SPREADING, "not spreading envelope");
            ExecutionEngine.Assert(envelope.Creator == creator, "not creator");
            ExecutionEngine.Assert(envelope.Active, "not active");
            ExecutionEngine.Assert(Runtime.Time > (ulong)envelope.ExpiryTime, "not expired");
            ExecutionEngine.Assert(envelope.RemainingAmount > 0, "no GAS remaining");

            BigInteger refundAmount = envelope.RemainingAmount;

            envelope.RemainingAmount = 0;
            envelope.Active = false;
            StoreEnvelopeData(envelopeId, envelope);

            GAS.Transfer(Runtime.ExecutingScriptHash, creator, refundAmount);

            ByteString tokenId = (ByteString)envelopeId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            UInt160 currentHolder = null;
            if (token != null)
            {
                currentHolder = (UInt160)OwnerOf(tokenId);
                if (currentHolder != null && currentHolder.IsValid)
                {
                    Burn(tokenId);
                }
            }

            DeleteSeed(envelopeId);
            OnEnvelopeRefunded(envelopeId, creator, refundAmount);
            OnEnvelopeBurned(envelopeId, currentHolder);

            return refundAmount;
        }

        public static BigInteger reclaimEnvelope(BigInteger envelopeId, UInt160 creator)
        {
            return ReclaimEnvelope(envelopeId, creator);
        }

        #endregion

        #region Lucky Pool + Claim NFT

        /// <summary>
        /// Claim from a lucky pool; mint a claim NFT holding one random packet amount.
        /// </summary>
        public static BigInteger ClaimFromPool(BigInteger poolId, UInt160 claimer)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(claimer), "unauthorized");

            EnvelopeData pool = GetEnvelopeData(poolId);
            ExecutionEngine.Assert(EnvelopeExists(pool), "pool not found");
            ExecutionEngine.Assert(pool.EnvelopeType == ENVELOPE_TYPE_POOL, "not lucky pool");
            ExecutionEngine.Assert(pool.Active, "not active");
            ExecutionEngine.Assert(pool.OpenedCount < pool.PacketCount, "pool depleted");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)pool.ExpiryTime, "expired");

            ByteString claimerKey = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_POOL_CLAIMER, (ByteString)poolId.ToByteArray()),
                (ByteString)(byte[])claimer);
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, claimerKey) == null, "already claimed");

            ValidateNeoHolding(claimer, pool.MinNeoRequired, pool.MinHoldSeconds);

            BigInteger packetIndex = pool.OpenedCount;
            ByteString seed = GetSeed(poolId);
            ExecutionEngine.Assert(seed != null, "seed missing");
            BigInteger amount = CalculateSinglePacketAmount(
                pool.TotalAmount,
                pool.PacketCount,
                (byte[])seed,
                packetIndex);
            ExecutionEngine.Assert(amount > 0, "invalid amount");

            Storage.Put(Storage.CurrentContext, claimerKey, amount);

            pool.OpenedCount += 1;
            pool.RemainingAmount -= amount;
            BigInteger remainingPackets = pool.PacketCount - pool.OpenedCount;
            if (remainingPackets == 0)
            {
                pool.Active = false;
                DeleteSeed(poolId);
            }
            StoreEnvelopeData(poolId, pool);

            BigInteger claimId = AllocateEnvelopeId();
            EnvelopeData claim = new EnvelopeData
            {
                Creator = pool.Creator,
                TotalAmount = amount,
                PacketCount = 1,
                Message = pool.Message,
                EnvelopeType = ENVELOPE_TYPE_CLAIM,
                ParentEnvelopeId = poolId,
                OpenedCount = 0,
                RemainingAmount = amount,
                MinNeoRequired = pool.MinNeoRequired,
                MinHoldSeconds = pool.MinHoldSeconds,
                Active = true,
                ExpiryTime = pool.ExpiryTime
            };
            StoreEnvelopeData(claimId, claim);

            ByteString claimTokenId = (ByteString)claimId.ToByteArray();
            Mint(claimTokenId, new RedEnvelopeState
            {
                Owner = claimer,
                Name = "ClaimEnvelope #" + claimId.ToString(),
                EnvelopeId = claimId,
                Creator = pool.Creator,
                TotalAmount = amount,
                PacketCount = 1,
                Message = pool.Message,
                EnvelopeType = ENVELOPE_TYPE_CLAIM,
                ParentEnvelopeId = poolId
            });

            StorePoolClaimId(poolId, pool.OpenedCount, claimId);
            OnEnvelopeOpened(poolId, claimer, amount, remainingPackets);
            OnEnvelopeCreated(claimId, pool.Creator, amount, 1, ENVELOPE_TYPE_CLAIM);

            return claimId;
        }

        public static BigInteger claimFromPool(BigInteger poolId, UInt160 claimer)
        {
            return ClaimFromPool(poolId, claimer);
        }

        /// <summary>
        /// Open a claim NFT and claim all GAS in that claim.
        /// </summary>
        public static BigInteger OpenClaim(BigInteger claimId, UInt160 opener)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(opener), "unauthorized");

            ByteString tokenId = (ByteString)claimId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            ExecutionEngine.Assert(token != null, "claim not found");
            ExecutionEngine.Assert(token.EnvelopeType == ENVELOPE_TYPE_CLAIM, "not claim NFT");

            UInt160 currentHolder = (UInt160)OwnerOf(tokenId);
            ExecutionEngine.Assert(currentHolder == opener, "not NFT holder");

            EnvelopeData claim = GetEnvelopeData(claimId);
            ExecutionEngine.Assert(EnvelopeExists(claim), "claim not found");
            ExecutionEngine.Assert(claim.EnvelopeType == ENVELOPE_TYPE_CLAIM, "not claim NFT");
            ExecutionEngine.Assert(claim.Active, "not active");
            ExecutionEngine.Assert(claim.OpenedCount == 0, "already opened");
            ExecutionEngine.Assert(claim.RemainingAmount > 0, "no GAS remaining");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)claim.ExpiryTime, "expired");

            ValidateNeoHolding(opener, claim.MinNeoRequired, claim.MinHoldSeconds);

            BigInteger amount = claim.RemainingAmount;
            claim.OpenedCount = 1;
            claim.RemainingAmount = 0;
            claim.Active = false;
            StoreEnvelopeData(claimId, claim);

            GAS.Transfer(Runtime.ExecutingScriptHash, opener, amount);
            OnEnvelopeOpened(claimId, opener, amount, 0);

            return amount;
        }

        public static BigInteger openClaim(BigInteger claimId, UInt160 opener)
        {
            return OpenClaim(claimId, opener);
        }

        /// <summary>
        /// Transfer claim NFT only before it is opened.
        /// </summary>
        public static void TransferClaim(BigInteger claimId, UInt160 from, UInt160 to)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");

            ByteString tokenId = (ByteString)claimId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            ExecutionEngine.Assert(token != null, "claim not found");
            ExecutionEngine.Assert(token.EnvelopeType == ENVELOPE_TYPE_CLAIM, "not claim NFT");

            UInt160 currentHolder = (UInt160)OwnerOf(tokenId);
            ExecutionEngine.Assert(currentHolder == from, "not NFT holder");

            EnvelopeData claim = GetEnvelopeData(claimId);
            ExecutionEngine.Assert(EnvelopeExists(claim), "claim not found");
            ExecutionEngine.Assert(claim.Active, "not active");
            ExecutionEngine.Assert(claim.OpenedCount == 0, "already opened");
            ExecutionEngine.Assert(Runtime.Time <= (ulong)claim.ExpiryTime, "expired");

            Transfer(from, to, 1, tokenId, null);
        }

        public static void transferClaim(BigInteger claimId, UInt160 from, UInt160 to)
        {
            TransferClaim(claimId, from, to);
        }

        /// <summary>
        /// Pool creator reclaims all unclaimed GAS:
        /// - remaining unclaimed pool balance
        /// - all unopened claim NFT balances
        /// </summary>
        public static BigInteger ReclaimPool(BigInteger poolId, UInt160 creator)
        {
            AssertNotPaused();
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized");

            EnvelopeData pool = GetEnvelopeData(poolId);
            ExecutionEngine.Assert(EnvelopeExists(pool), "pool not found");
            ExecutionEngine.Assert(pool.EnvelopeType == ENVELOPE_TYPE_POOL, "not lucky pool");
            ExecutionEngine.Assert(pool.Creator == creator, "not creator");
            ExecutionEngine.Assert(Runtime.Time > (ulong)pool.ExpiryTime, "not expired");

            BigInteger refundAmount = pool.RemainingAmount;

            for (BigInteger i = 1; i <= pool.OpenedCount; i++)
            {
                BigInteger claimId = GetPoolClaimId(poolId, i);
                if (claimId <= 0) continue;

                EnvelopeData claim = GetEnvelopeData(claimId);
                if (!EnvelopeExists(claim)) continue;
                if (claim.EnvelopeType != ENVELOPE_TYPE_CLAIM) continue;

                if (claim.Active && claim.RemainingAmount > 0)
                {
                    refundAmount += claim.RemainingAmount;
                    claim.RemainingAmount = 0;
                    claim.Active = false;
                    StoreEnvelopeData(claimId, claim);
                }
            }

            ExecutionEngine.Assert(refundAmount > 0, "no GAS remaining");

            pool.RemainingAmount = 0;
            pool.Active = false;
            StoreEnvelopeData(poolId, pool);
            DeleteSeed(poolId);

            GAS.Transfer(Runtime.ExecutingScriptHash, creator, refundAmount);
            OnEnvelopeRefunded(poolId, creator, refundAmount);

            return refundAmount;
        }

        public static BigInteger reclaimPool(BigInteger poolId, UInt160 creator)
        {
            return ReclaimPool(poolId, creator);
        }

        #endregion

        #region NEO Holding Validation

        private static void ValidateNeoHolding(UInt160 account, BigInteger minNeo, BigInteger minHoldSeconds)
        {
            BigInteger neoBalance = (BigInteger)NEO.BalanceOf(account);
            ExecutionEngine.Assert(neoBalance >= minNeo, "insufficient NEO");

            object[] state = (object[])Contract.Call(
                NEO_HASH,
                "getAccountState",
                CallFlags.ReadOnly,
                new object[] { account });
            ExecutionEngine.Assert(state != null, "no NEO state");

            BigInteger balanceHeight = (BigInteger)state[2];
            BigInteger blockTs = (BigInteger)Ledger.GetBlock((uint)balanceHeight).Timestamp;
            BigInteger holdDuration = (BigInteger)Runtime.Time - blockTs;
            ExecutionEngine.Assert(holdDuration >= minHoldSeconds, "hold duration not met");
        }

        #endregion

        #region Random Distribution

        [Safe]
        public static BigInteger CalculatePacketAmount(BigInteger envelopeId, BigInteger packetIndex)
        {
            EnvelopeData envelope = GetEnvelopeData(envelopeId);
            if (!EnvelopeExists(envelope)) return 0;

            ByteString seed = GetSeed(envelopeId);
            if (seed == null) return 0;

            return CalculateSinglePacketAmount(
                envelope.TotalAmount,
                envelope.PacketCount,
                (byte[])seed,
                packetIndex);
        }

        private static BigInteger CalculateSinglePacketAmount(
            BigInteger totalAmount,
            BigInteger packetCount,
            byte[] seed,
            BigInteger targetIndex)
        {
            BigInteger minPerPacket = MIN_PER_PACKET;

            if (targetIndex == packetCount - 1)
            {
                BigInteger prevSum = CalculatePreviousSum(totalAmount, packetCount, seed, targetIndex);
                return totalAmount - prevSum;
            }

            BigInteger previousSum = CalculatePreviousSum(totalAmount, packetCount, seed, targetIndex);
            BigInteger remaining = totalAmount - previousSum;
            BigInteger packetsLeft = packetCount - targetIndex;
            BigInteger maxForThis = remaining - (packetsLeft - 1) * minPerPacket;
            BigInteger randValue = GetRandFromSeed(seed, targetIndex);
            BigInteger range = maxForThis - minPerPacket;

            if (range > 0)
                return minPerPacket + (randValue % range);
            return minPerPacket;
        }

        private static BigInteger CalculatePreviousSum(
            BigInteger totalAmount,
            BigInteger packetCount,
            byte[] seed,
            BigInteger targetIndex)
        {
            BigInteger minPerPacket = MIN_PER_PACKET;
            BigInteger remaining = totalAmount;
            BigInteger sum = 0;

            for (BigInteger i = 0; i < targetIndex; i++)
            {
                BigInteger packetsLeft = packetCount - i;
                BigInteger maxForThis = remaining - (packetsLeft - 1) * minPerPacket;
                BigInteger randValue = GetRandFromSeed(seed, i);
                BigInteger range = maxForThis - minPerPacket;
                BigInteger amount = minPerPacket;
                if (range > 0) amount = minPerPacket + (randValue % range);
                sum += amount;
                remaining -= amount;
            }

            return sum;
        }

        private static BigInteger GetRandFromSeed(byte[] seed, BigInteger index)
        {
            byte[] indexBytes = index.ToByteArray();
            byte[] combined = Helper.Concat(seed, indexBytes);
            ByteString hash = CryptoLib.Sha256((ByteString)combined);
            return ToPositiveInteger((byte[])hash);
        }

        private static BigInteger ToPositiveInteger(byte[] bytes)
        {
            byte[] unsigned = new byte[bytes.Length + 1];
            for (int i = 0; i < bytes.Length; i++)
            {
                unsigned[i] = bytes[i];
            }
            return new BigInteger(unsigned);
        }

        #endregion
    }
}
