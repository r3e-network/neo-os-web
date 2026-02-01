using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppStreamVault
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetStreamDetails(BigInteger streamId)
        {
            StreamData stream = GetStream(streamId);
            Map<string, object> details = new Map<string, object>();
            if (stream.Creator == UInt160.Zero) return details;

            details["id"] = streamId;
            details["creator"] = stream.Creator;
            details["beneficiary"] = stream.Beneficiary;
            details["asset"] = stream.Asset;
            details["assetSymbol"] = IsNeo(stream.Asset) ? "NEO" : "GAS";
            details["totalAmount"] = stream.TotalAmount;
            details["releasedAmount"] = stream.ReleasedAmount;
            details["remainingAmount"] = stream.TotalAmount - stream.ReleasedAmount;
            details["rateAmount"] = stream.RateAmount;
            details["intervalSeconds"] = stream.IntervalSeconds;
            details["startTime"] = stream.StartTime;
            details["lastClaimTime"] = stream.LastClaimTime;
            details["createdTime"] = stream.CreatedTime;
            details["active"] = stream.Active;
            details["cancelled"] = stream.Cancelled;
            details["status"] = stream.Active ? "active" : stream.Cancelled ? "cancelled" : "completed";
            details["title"] = stream.Title;
            details["notes"] = stream.Notes;
            details["claimable"] = CalculateClaimable(stream, Runtime.Time);
            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalStreams"] = TotalStreams();
            stats["totalLocked"] = TotalLocked();
            stats["totalReleased"] = TotalReleased();
            stats["minNeo"] = MIN_NEO;
            stats["minGas"] = MIN_GAS;
            stats["minIntervalSeconds"] = MIN_INTERVAL_SECONDS;
            stats["maxIntervalSeconds"] = MAX_INTERVAL_SECONDS;
            return stats;
        }

        [Safe]
        public static BigInteger GetUserStreamCount(UInt160 user)
        {
            return GetStreamCountForUser(user);
        }

        [Safe]
        public static BigInteger GetBeneficiaryStreamCount(UInt160 beneficiary)
        {
            return GetStreamCountForBeneficiary(beneficiary);
        }

        [Safe]
        public static BigInteger[] GetUserStreams(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetStreamCountForUser(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_STREAMS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static BigInteger[] GetBeneficiaryStreams(UInt160 beneficiary, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetStreamCountForBeneficiary(beneficiary);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_BENEFICIARY_STREAMS, beneficiary),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        #endregion
    }
}
