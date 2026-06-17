using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Read-only
        [Safe]
        public static BigInteger LastCapsuleId() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CAP_ID);

        [Safe]
        public static BigInteger CreditOf(UInt160 owner) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])owner));

        [Safe]
        public static BigInteger FishRevenueOf(UInt160 owner) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_FISH_REV, (byte[])owner));

        [Safe]
        public static Map<string, object> GetCapsule(BigInteger capsuleId)
        {
            Capsule c = LoadCapsule(Storage.CurrentContext, capsuleId);
            Map<string, object> r = new Map<string, object>();
            r["id"] = capsuleId;
            r["owner"] = c.Owner;
            r["contentHash"] = c.ContentHash;
            r["unlockTime"] = c.UnlockTime;
            r["isPublic"] = c.IsPublic;
            r["category"] = c.Category;
            r["revealed"] = c.Revealed;
            r["amount"] = c.Amount;
            r["fished"] = c.Fished;
            return r;
        }

        [Safe]
        public static BigInteger OwnerCapsuleCount(UInt160 owner) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_OWNER_CNT, (byte[])owner));

        [Safe]
        public static BigInteger[] GetOwnerCapsules(UInt160 owner, BigInteger offset, BigInteger limit)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger n = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_OWNER_CNT, (byte[])owner));
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
                byte[] itemKey = Helper.Concat(Helper.Concat(PREFIX_OWNER_ITEM, (byte[])owner), (byte[])(ByteString)i);
                result[(int)idx] = (BigInteger)Storage.Get(ctx, itemKey);
                idx += 1;
            }
            return result;
        }
        #endregion
    }
}
