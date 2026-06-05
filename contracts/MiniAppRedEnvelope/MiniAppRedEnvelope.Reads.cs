using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope : SmartContract
    {
        #region Read-only
        [Safe]
        public static BigInteger LastEnvelopeId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENV_ID);

        [Safe]
        public static BigInteger CreditOf(UInt160 creator) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])creator));

        [Safe]
        public static BigInteger ClaimedAmount(BigInteger envelopeId, UInt160 claimer) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, ClaimedKey(envelopeId, claimer));

        [Safe]
        public static bool HasClaimed(BigInteger envelopeId, UInt160 claimer) =>
            Storage.Get(Storage.CurrentContext, ClaimedKey(envelopeId, claimer)) is not null;

        [Safe]
        public static Map<string, object> GetEnvelope(BigInteger envelopeId)
        {
            Envelope e = LoadEnvelope(envelopeId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = envelopeId;
            r["creator"] = e.Creator;
            r["totalAmount"] = e.TotalAmount;
            r["remainingAmount"] = e.RemainingAmount;
            r["packetCount"] = e.PacketCount;
            r["openedCount"] = e.OpenedCount;
            r["expiryTime"] = e.ExpiryTime;
            r["bestLuckAddress"] = e.BestLuckAddress;
            r["bestLuckAmount"] = e.BestLuckAmount;
            r["active"] = e.Active;
            return r;
        }

        [Safe]
        public static BigInteger CreatorEnvelopeCount(UInt160 creator) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREATOR_CNT, (byte[])creator));

        [Safe]
        public static BigInteger[] GetCreatorEnvelopes(UInt160 creator, BigInteger offset, BigInteger limit) =>
            IndexSlice(PREFIX_CREATOR_CNT, PREFIX_CREATOR_ITEM, creator, offset, limit);

        [Safe]
        public static BigInteger ClaimerEnvelopeCount(UInt160 claimer) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CLAIMER_CNT, (byte[])claimer));

        [Safe]
        public static BigInteger[] GetClaimerEnvelopes(UInt160 claimer, BigInteger offset, BigInteger limit) =>
            IndexSlice(PREFIX_CLAIMER_CNT, PREFIX_CLAIMER_ITEM, claimer, offset, limit);
        #endregion

        #region Internal
        private static Envelope LoadEnvelope(BigInteger envelopeId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, EnvKey(envelopeId));
            ExecutionEngine.Assert(raw is not null, "envelope not found");
            return (Envelope)StdLib.Deserialize(raw);
        }

        private static byte[] EnvKey(BigInteger id) => Helper.Concat(PREFIX_ENV, (byte[])(ByteString)id);

        private static byte[] ClaimedKey(BigInteger envelopeId, UInt160 claimer) =>
            Helper.Concat(Helper.Concat(PREFIX_CLAIMED, (byte[])(ByteString)envelopeId), (byte[])claimer);

        /// <summary>Append envId to a per-account index (count + 1-based item list).</summary>
        private static void IndexAppend(StorageContext ctx, byte[] cntPrefix, byte[] itemPrefix, UInt160 account, BigInteger envId)
        {
            byte[] cntKey = Helper.Concat(cntPrefix, (byte[])account);
            BigInteger n = (BigInteger)Storage.Get(ctx, cntKey) + 1;
            Storage.Put(ctx, cntKey, n);
            byte[] itemKey = Helper.Concat(Helper.Concat(itemPrefix, (byte[])account), (byte[])(ByteString)n);
            Storage.Put(ctx, itemKey, envId);
        }

        /// <summary>Read a [offset, offset+limit) slice of a per-account index (1-based).</summary>
        private static BigInteger[] IndexSlice(byte[] cntPrefix, byte[] itemPrefix, UInt160 account, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(cntPrefix, (byte[])account));
            if (offset < 0) offset = 0;
            if (limit <= 0 || limit > 100) limit = 100;
            BigInteger start = offset + 1;
            BigInteger end = start + limit - 1;
            if (end > n) end = n;
            if (start > end) return new BigInteger[0];

            BigInteger count = end - start + 1;
            BigInteger[] result = new BigInteger[(int)count];
            BigInteger idx = 0;
            for (BigInteger i = start; i <= end; i++)
            {
                byte[] itemKey = Helper.Concat(Helper.Concat(itemPrefix, (byte[])account), (byte[])(ByteString)i);
                result[(int)idx] = (BigInteger)Storage.Get(ctx, itemKey);
                idx += 1;
            }
            return result;
        }
        #endregion
    }
}
