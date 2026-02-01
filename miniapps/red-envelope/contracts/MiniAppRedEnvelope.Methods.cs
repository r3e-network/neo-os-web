using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Frontend Calculation Support

        /// <summary>
        /// Get all constants for frontend distribution calculations.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCalculationConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["minAmount"] = MIN_AMOUNT;
            constants["maxPackets"] = MAX_PACKETS;
            constants["minPerPacket"] = 1000000;
            constants["bestLuckBonusRate"] = BEST_LUCK_BONUS_RATE;
            constants["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        /// <summary>
        /// Get envelope state for frontend display.
        /// </summary>
        [Safe]
        public static Map<string, object> GetEnvelopeStateForFrontend(BigInteger envelopeId)
        {
            EnvelopeData envelope = GetEnvelope(envelopeId);
            Map<string, object> state = new Map<string, object>();

            if (envelope.Creator == UInt160.Zero) return state;

            state["id"] = envelopeId;
            state["creator"] = envelope.Creator;
            state["totalAmount"] = envelope.TotalAmount;
            state["packetCount"] = envelope.PacketCount;
            state["claimedCount"] = envelope.ClaimedCount;
            state["remainingAmount"] = envelope.RemainingAmount;
            state["bestLuckAddress"] = envelope.BestLuckAddress;
            state["bestLuckAmount"] = envelope.BestLuckAmount;
            state["ready"] = envelope.Ready;
            state["expiryTime"] = envelope.ExpiryTime;
            state["message"] = envelope.Message;
            state["currentTime"] = Runtime.Time;
            state["isExpired"] = Runtime.Time > (ulong)envelope.ExpiryTime;
            state["isEmpty"] = envelope.ClaimedCount >= envelope.PacketCount;
            state["remainingPackets"] = envelope.PacketCount - envelope.ClaimedCount;

            return state;
        }

        /// <summary>
        /// Get all claimed amounts for an envelope.
        /// </summary>
        [Safe]
        public static Map<string, object> GetEnvelopeClaimHistory(BigInteger envelopeId)
        {
            EnvelopeData envelope = GetEnvelope(envelopeId);
            Map<string, object> history = new Map<string, object>();

            if (envelope.Creator == UInt160.Zero) return history;

            history["totalPackets"] = envelope.PacketCount;
            history["claimedCount"] = envelope.ClaimedCount;

            BigInteger[] amounts = new BigInteger[(int)envelope.ClaimedCount];
            for (BigInteger i = 1; i <= envelope.ClaimedCount; i++)
            {
                amounts[(int)(i - 1)] = GetPacketAmount(envelopeId, i);
            }
            history["claimedAmounts"] = amounts;
            history["bestLuckAmount"] = envelope.BestLuckAmount;
            history["bestLuckAddress"] = envelope.BestLuckAddress;

            return history;
        }

        /// <summary>
        /// Calculate best luck bonus amount.
        /// </summary>
        [Safe]
        public static BigInteger CalculateBestLuckBonus(BigInteger bestLuckAmount)
        {
            return bestLuckAmount * BEST_LUCK_BONUS_RATE / 100;
        }

        /// <summary>
        /// Get user statistics for frontend display.
        /// </summary>
        [Safe]
        public static Map<string, object> GetUserStatsForFrontend(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> result = new Map<string, object>();

            result["envelopesCreated"] = stats.EnvelopesCreated;
            result["envelopesClaimed"] = stats.EnvelopesClaimed;
            result["totalSent"] = stats.TotalSent;
            result["totalReceived"] = stats.TotalReceived;
            result["bestLuckWins"] = stats.BestLuckWins;
            result["highestSingleClaim"] = stats.HighestSingleClaim;
            result["highestEnvelopeCreated"] = stats.HighestEnvelopeCreated;
            result["badgeCount"] = stats.BadgeCount;
            result["joinTime"] = stats.JoinTime;
            result["lastActivityTime"] = stats.LastActivityTime;

            if (stats.EnvelopesClaimed > 0)
                result["averageClaimAmount"] = stats.TotalReceived / stats.EnvelopesClaimed;
            else
                result["averageClaimAmount"] = 0;

            if (stats.EnvelopesCreated > 0)
                result["averageEnvelopeSize"] = stats.TotalSent / stats.EnvelopesCreated;
            else
                result["averageEnvelopeSize"] = 0;

            return result;
        }



        #endregion

        #region One-Phase Envelope Creation

        /// <summary>
        /// Create a new red envelope.
        /// Generates deterministic seed on-chain and marks envelope ready immediately.
        /// Claiming calculates amounts on-demand using the seed.
        /// </summary>
        public static BigInteger CreateEnvelope(
            UInt160 creator,
            BigInteger totalAmount,
            BigInteger packetCount,
            BigInteger expiryDurationSeconds,
            string message,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            ExecutionEngine.Assert(totalAmount >= MIN_AMOUNT, "min amount 0.1 GAS");
            ExecutionEngine.Assert(packetCount > 0 && packetCount <= MAX_PACKETS, "1-100 packets");
            ExecutionEngine.Assert(totalAmount >= packetCount * 1000000, "min 0.01 GAS per packet");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, totalAmount, receiptId);

            // Generate envelope ID
            BigInteger envelopeId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_ENVELOPE_ID, envelopeId);

            // Generate deterministic seed (acts as randomness source)
            ByteString seed = CryptoLib.Sha256(Helper.Concat((ByteString)envelopeId.ToByteArray(), (ByteString)creator));
            
            // Manually store seed to allow CalculatePacketAmount to find it via GetOperationSeed
            // using the protected PREFIX_OPERATION_SEED from MiniAppComputeBase
            StorageMap seedMap = new StorageMap(Storage.CurrentContext, PREFIX_OPERATION_SEED);
            seedMap.Put(envelopeId.ToByteArray(), seed);

            BigInteger expiry = expiryDurationSeconds > 0 ? expiryDurationSeconds : DEFAULT_EXPIRY_SECONDS;

            // Create envelope in READY state immediately
            EnvelopeData envelope = new EnvelopeData
            {
                Creator = creator,
                TotalAmount = totalAmount,
                PacketCount = packetCount,
                ClaimedCount = 0,
                RemainingAmount = totalAmount,
                BestLuckAddress = UInt160.Zero,
                BestLuckAmount = 0,
                Ready = true, // Ready immediately
                ExpiryTime = (BigInteger)Runtime.Time + expiry,
                Message = message
            };
            StoreEnvelope(envelopeId, envelope);

            // Update user stats
            UserStats stats = GetUserStats(creator);
            bool isNewUser = stats.JoinTime == 0;
            stats.EnvelopesCreated += 1;
            stats.TotalSent += totalAmount;
            if (totalAmount > stats.HighestEnvelopeCreated) stats.HighestEnvelopeCreated = totalAmount;
            if (isNewUser)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }
            stats.LastActivityTime = Runtime.Time;
            StoreUserStats(creator, stats);

            // Update global stats
            BigInteger currentTotalInfo = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES, currentTotalInfo + 1);
            
            BigInteger currentDistributed = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED, currentDistributed + totalAmount);

            OnEnvelopeCreated(envelopeId, creator, totalAmount, packetCount);

            return envelopeId;
        }

        #endregion

        #region On-Chain Calculation Logic

        /// <summary>
        /// Calculate single packet amount on-demand (O(1) per claim).
        /// </summary>
        [Safe]
        public static BigInteger CalculatePacketAmount(
            BigInteger envelopeId,
            BigInteger packetIndex)
        {
            EnvelopeData envelope = GetEnvelope(envelopeId);
            if (envelope.Creator == UInt160.Zero) return 0;

            // Get seed using MiniAppComputeBase method
            ByteString seed = GetOperationSeed(envelopeId);
            if (seed == null) return 0;

            return CalculateSinglePacketAmount(
                envelope.TotalAmount,
                envelope.PacketCount,
                (byte[])seed,
                packetIndex);
        }

        /// <summary>
        /// Calculate single packet amount deterministically.
        /// </summary>
        private static BigInteger CalculateSinglePacketAmount(
            BigInteger totalAmount,
            BigInteger packetCount,
            byte[] seed,
            BigInteger targetIndex)
        {
            BigInteger minPerPacket = 1000000; // 0.01 GAS

            // For last packet, calculate remainder directly
            if (targetIndex == packetCount - 1)
            {
                BigInteger lastPacketPrevSum = CalculatePreviousSum(totalAmount, packetCount, seed, targetIndex);
                return totalAmount - lastPacketPrevSum;
            }

            // Calculate how much has been distributed before this index
            BigInteger previousSum = CalculatePreviousSum(totalAmount, packetCount, seed, targetIndex);
            
            // Calculate this packet
            BigInteger remaining = totalAmount - previousSum;
            BigInteger packetsLeft = packetCount - targetIndex;
            BigInteger maxForThis = remaining - (packetsLeft - 1) * minPerPacket;
            BigInteger randValue = GetRandFromSeed(seed, targetIndex);
            BigInteger range = maxForThis - minPerPacket;
            
            if (range > 0)
            {
                return minPerPacket + (randValue % range);
            }
            return minPerPacket;
        }

        /// <summary>
        /// Calculate sum of packets before targetIndex.
        /// </summary>
        private static BigInteger CalculatePreviousSum(
            BigInteger totalAmount,
            BigInteger packetCount,
            byte[] seed,
            BigInteger targetIndex)
        {
            BigInteger minPerPacket = 1000000;
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

        /// <summary>
        /// Generate deterministic random value from seed and index.
        /// </summary>
        private static BigInteger GetRandFromSeed(byte[] seed, BigInteger index)
        {
            byte[] indexBytes = index.ToByteArray();
            byte[] combined = Helper.Concat(seed, indexBytes);
            ByteString hash = CryptoLib.Sha256((ByteString)combined);
            return ToPositiveInteger((byte[])hash);
        }

        /// <summary>
        /// Convert bytes to positive BigInteger.
        /// </summary>
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
