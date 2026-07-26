using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformVestingContract
    {
        [Safe]
        public static BigInteger TotalStreams(string appId) => ReadInteger(AppKey(appId, PREFIX_STREAM_COUNT));

        [Safe]
        public static BigInteger CreditOf(string appId, UInt160 asset, UInt160 payer)
        {
            if (!IsSupportedAsset(asset)) return 0;
            return ReadCredit(appId, asset, payer);
        }

        [Safe]
        public static BigInteger CreditLiabilityOf(string appId, UInt160 asset)
        {
            if (!IsSupportedAsset(asset)) return 0;
            return ReadInteger(CreditLiabilityKey(appId, asset));
        }

        [Safe]
        public static BigInteger StreamLiabilityOf(string appId, UInt160 asset)
        {
            if (!IsSupportedAsset(asset)) return 0;
            return ReadInteger(StreamLiabilityKey(appId, asset));
        }

        [Safe]
        public static BigInteger TotalCreditLiability(UInt160 asset)
        {
            if (!IsSupportedAsset(asset)) return 0;
            byte[] key = asset == GAS.Hash ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY : PREFIX_TOTAL_NEO_CREDIT_LIABILITY;
            return ReadInteger(key);
        }

        [Safe]
        public static object GetStreamDetails(string appId, BigInteger streamId)
        {
            object[] stream = ReadStream(appId, streamId);
            Map<string, object> details = new Map<string, object>();
            details["id"] = stream[0];
            details["creator"] = stream[1];
            details["beneficiary"] = stream[2];
            details["asset"] = stream[3];
            details["totalAmount"] = stream[4];
            details["releasedAmount"] = stream[5];
            details["remainingAmount"] = (BigInteger)stream[4] - (BigInteger)stream[5];
            details["rateAmount"] = stream[6];
            details["intervalSeconds"] = stream[7];
            details["claimable"] = Claimable(stream);
            details["status"] = StatusName((BigInteger)stream[9]);
            details["title"] = stream[10];
            details["notes"] = stream[11];
            return details;
        }

        [Safe]
        public static object[] GetUserStreams(string appId, UInt160 creator, BigInteger offset, BigInteger limit) =>
            ReadIndex(appId, PREFIX_CREATOR_COUNT, PREFIX_CREATOR_INDEX, creator, offset, limit);

        [Safe]
        public static object[] GetBeneficiaryStreams(string appId, UInt160 beneficiary, BigInteger offset, BigInteger limit) =>
            ReadIndex(appId, PREFIX_BENEFICIARY_COUNT, PREFIX_BENEFICIARY_INDEX, beneficiary, offset, limit);

        [Safe]
        public static BigInteger ClaimableOf(string appId, BigInteger streamId)
        {
            return Claimable(ReadStream(appId, streamId));
        }

        private static object[] ReadStream(string appId, BigInteger streamId)
        {
            ExecutionEngine.Assert(streamId > 0, "invalid stream id");
            ByteString raw = Storage.Get(Storage.CurrentContext, StreamKey(appId, streamId));
            ExecutionEngine.Assert(raw != null, "stream not found");
            return (object[])StdLib.Deserialize(raw);
        }

        private static BigInteger ReadCredit(string appId, UInt160 asset, UInt160 payer)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, CreditKey(appId, asset, payer));
            return raw == null ? 0 : (BigInteger)raw;
        }

        private static BigInteger Claimable(object[] stream)
        {
            if ((BigInteger)stream[9] != 1) return 0;
            BigInteger elapsed = Runtime.Time - (BigInteger)stream[8];
            if (elapsed <= 0) return 0;
            BigInteger intervalMs = (BigInteger)stream[7] * MILLISECONDS_PER_SECOND;
            BigInteger vested = (elapsed / intervalMs) * (BigInteger)stream[6];
            if (vested > (BigInteger)stream[4]) vested = (BigInteger)stream[4];
            BigInteger claimable = vested - (BigInteger)stream[5];
            return claimable > 0 ? claimable : 0;
        }

        private static string StatusName(BigInteger status)
        {
            if (status == 1) return "active";
            if (status == 2) return "completed";
            return "cancelled";
        }

        private static object[] ReadIndex(string appId, byte[] countPrefix, byte[] indexPrefix, UInt160 account, BigInteger offset, BigInteger limit)
        {
            ValidateAddress(account);
            ExecutionEngine.Assert(offset >= 0 && limit > 0 && limit <= MAX_PAGE_SIZE, "invalid page");
            BigInteger count = ReadInteger(AccountKey(appId, countPrefix, account));
            if (offset >= count) return new object[0];
            BigInteger remaining = count - offset;
            BigInteger take = remaining < limit ? remaining : limit;
            object[] result = new object[(int)take];
            for (int i = 0; i < result.Length; i++)
            {
                result[i] = ReadInteger(IndexKey(appId, indexPrefix, account, offset + i));
            }
            return result;
        }
    }
}
