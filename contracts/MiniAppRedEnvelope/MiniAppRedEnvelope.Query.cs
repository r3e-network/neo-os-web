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
        #region Query Methods

        [Safe]
        public static Map<string, object> GetEnvelopeDetails(BigInteger envelopeId)
        {
            EnvelopeData envelope = GetEnvelope(envelopeId);
            Map<string, object> details = new Map<string, object>();
            if (envelope.Creator == UInt160.Zero) return details;

            details["id"] = envelopeId;
            details["creator"] = envelope.Creator;
            details["totalAmount"] = envelope.TotalAmount;
            details["packetCount"] = envelope.PacketCount;
            details["claimedCount"] = envelope.ClaimedCount;
            details["remainingAmount"] = envelope.RemainingAmount;
            details["bestLuckAddress"] = envelope.BestLuckAddress;
            details["bestLuckAmount"] = envelope.BestLuckAmount;
            details["ready"] = envelope.Ready;
            details["expiryTime"] = envelope.ExpiryTime;
            details["message"] = envelope.Message;

            if (!envelope.Ready)
                details["status"] = "pending";
            else if (envelope.ClaimedCount >= envelope.PacketCount)
                details["status"] = "completed";
            else if (Runtime.Time > (ulong)envelope.ExpiryTime)
                details["status"] = "expired";
            else
            {
                details["status"] = "active";
                details["remainingPackets"] = envelope.PacketCount - envelope.ClaimedCount;
            }

            return details;
        }

        #endregion
    }
}
