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
        #region Envelope State

        [Safe]
        public static Map<string, object> GetEnvelopeState(BigInteger envelopeId)
        {
            Map<string, object> result = new Map<string, object>();
            EnvelopeData envelope = GetEnvelopeData(envelopeId);
            if (!EnvelopeExists(envelope)) return result;

            result["id"] = envelopeId;
            result["creator"] = envelope.Creator;
            result["totalAmount"] = envelope.TotalAmount;
            result["packetCount"] = envelope.PacketCount;
            result["openedCount"] = envelope.OpenedCount;
            result["claimedCount"] = envelope.OpenedCount;
            result["remainingAmount"] = envelope.RemainingAmount;
            result["remainingPackets"] = envelope.PacketCount - envelope.OpenedCount;
            result["minNeoRequired"] = envelope.MinNeoRequired;
            result["minHoldSeconds"] = envelope.MinHoldSeconds;
            result["active"] = envelope.Active;
            result["expiryTime"] = envelope.ExpiryTime;
            result["currentTime"] = Runtime.Time;
            result["isExpired"] = Runtime.Time > (ulong)envelope.ExpiryTime;
            result["isDepleted"] =
                envelope.OpenedCount >= envelope.PacketCount || envelope.RemainingAmount <= 0;
            result["message"] = envelope.Message;
            result["envelopeType"] = envelope.EnvelopeType;
            result["parentEnvelopeId"] = envelope.ParentEnvelopeId;

            if (envelope.EnvelopeType == ENVELOPE_TYPE_SPREADING || envelope.EnvelopeType == ENVELOPE_TYPE_CLAIM)
            {
                ByteString tokenId = (ByteString)envelopeId.ToByteArray();
                RedEnvelopeState token = GetTokenState(tokenId);
                if (token != null)
                {
                    result["currentHolder"] = (UInt160)OwnerOf(tokenId);
                }
                else
                {
                    result["currentHolder"] = UInt160.Zero;
                }
            }
            else
            {
                result["currentHolder"] = UInt160.Zero;
            }

            return result;
        }

        [Safe]
        public static Map<string, object> GetEnvelopeStateForFrontend(BigInteger envelopeId)
        {
            return GetEnvelopeState(envelopeId);
        }

        [Safe]
        public static Map<string, object> getEnvelopeStateForFrontend(BigInteger envelopeId)
        {
            return GetEnvelopeStateForFrontend(envelopeId);
        }

        #endregion

        #region Claim NFT Query

        [Safe]
        public static Map<string, object> GetClaimState(BigInteger claimId)
        {
            Map<string, object> result = new Map<string, object>();
            EnvelopeData claim = GetEnvelopeData(claimId);
            if (!EnvelopeExists(claim)) return result;
            if (claim.EnvelopeType != ENVELOPE_TYPE_CLAIM) return result;

            ByteString tokenId = (ByteString)claimId.ToByteArray();
            RedEnvelopeState token = GetTokenState(tokenId);
            UInt160 holder = UInt160.Zero;
            if (token != null)
            {
                holder = (UInt160)OwnerOf(tokenId);
            }

            result["id"] = claimId;
            result["poolId"] = claim.ParentEnvelopeId;
            result["holder"] = holder;
            result["amount"] = claim.TotalAmount;
            result["opened"] = claim.OpenedCount > 0 || !claim.Active || claim.RemainingAmount == 0;
            result["message"] = claim.Message;
            result["expiryTime"] = claim.ExpiryTime;

            return result;
        }

        [Safe]
        public static Map<string, object> getClaimState(BigInteger claimId)
        {
            return GetClaimState(claimId);
        }

        #endregion

        #region Eligibility Check

        [Safe]
        public static Map<string, object> CheckEligibility(BigInteger envelopeId, UInt160 user)
        {
            Map<string, object> result = new Map<string, object>();
            EnvelopeData envelope = GetEnvelopeData(envelopeId);

            if (!EnvelopeExists(envelope))
            {
                result["eligible"] = false;
                result["reason"] = "envelope not found";
                return result;
            }

            if (!envelope.Active)
            {
                result["eligible"] = false;
                result["reason"] = "not active";
                return result;
            }

            BigInteger neoBalance = (BigInteger)Contract.Call(
                NEO_HASH,
                "balanceOf",
                CallFlags.ReadOnly,
                new object[] { user });
            result["neoBalance"] = neoBalance;
            result["minNeoRequired"] = envelope.MinNeoRequired;

            if (neoBalance < envelope.MinNeoRequired)
            {
                result["eligible"] = false;
                result["reason"] = "insufficient NEO";
                return result;
            }

            object[] state = (object[])Contract.Call(
                NEO_HASH,
                "getAccountState",
                CallFlags.ReadOnly,
                new object[] { user });

            if (state == null)
            {
                result["eligible"] = false;
                result["reason"] = "no NEO state";
                return result;
            }

            BigInteger balanceHeight = (BigInteger)state[2];
            BigInteger blockTs = (BigInteger)Ledger.GetBlock((uint)balanceHeight).Timestamp;
            BigInteger holdDuration = (BigInteger)Runtime.Time - blockTs;
            BigInteger holdDays = holdDuration / 86400;

            result["holdDuration"] = holdDuration;
            result["holdDays"] = holdDays;
            result["minHoldSeconds"] = envelope.MinHoldSeconds;

            if (holdDuration < envelope.MinHoldSeconds)
            {
                result["eligible"] = false;
                result["reason"] = "hold duration not met";
                return result;
            }

            result["eligible"] = true;
            result["reason"] = "ok";
            return result;
        }

        [Safe]
        public static Map<string, object> checkEligibility(BigInteger envelopeId, UInt160 user)
        {
            return CheckEligibility(envelopeId, user);
        }

        #endregion

        #region Open/Claim Checks

        [Safe]
        public static bool HasOpened(BigInteger envelopeId, UInt160 opener)
        {
            ByteString key = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_OPENER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])opener);
            return Storage.Get(Storage.CurrentContext, key) != null;
        }

        [Safe]
        public static bool hasOpened(BigInteger envelopeId, UInt160 opener)
        {
            return HasOpened(envelopeId, opener);
        }

        [Safe]
        public static BigInteger GetOpenedAmount(BigInteger envelopeId, UInt160 opener)
        {
            ByteString key = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_OPENER, (ByteString)envelopeId.ToByteArray()),
                (ByteString)(byte[])opener);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return 0;
            return (BigInteger)data;
        }

        [Safe]
        public static BigInteger getOpenedAmount(BigInteger envelopeId, UInt160 opener)
        {
            return GetOpenedAmount(envelopeId, opener);
        }

        #endregion

        #region Constants + Stats

        [Safe]
        public static Map<string, object> GetCalculationConstants()
        {
            Map<string, object> c = new Map<string, object>();
            c["minAmount"] = MIN_AMOUNT;
            c["maxPackets"] = MAX_PACKETS;
            c["minPerPacket"] = MIN_PER_PACKET;
            c["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            c["defaultMinNeo"] = DEFAULT_MIN_NEO;
            c["defaultMinHoldSeconds"] = DEFAULT_MIN_HOLD_SECONDS;
            c["typeSpreading"] = ENVELOPE_TYPE_SPREADING;
            c["typePool"] = ENVELOPE_TYPE_POOL;
            c["typeClaim"] = ENVELOPE_TYPE_CLAIM;
            c["currentTime"] = Runtime.Time;
            return c;
        }

        [Safe]
        public static BigInteger GetTotalEnvelopes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES);

        [Safe]
        public static BigInteger GetTotalDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED);

        #endregion
    }
}
