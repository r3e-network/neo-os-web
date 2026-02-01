using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMemorialShrine
    {
        #region 存储辅助方法

        private static void StoreMemorial(BigInteger memorialId, Memorial memorial)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORIALS, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(memorial));
        }

        private static void StoreTribute(BigInteger tributeId, Tribute tribute)
        {
            byte[] key = Helper.Concat(PREFIX_TRIBUTES, (ByteString)tributeId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(tribute));
        }

        #endregion

        #region 创建者灵位列表

        private static void AddCreatorMemorial(UInt160 creator, BigInteger memorialId)
        {
            BigInteger count = GetCreatorMemorialCount(creator);
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_MEMORIALS, creator),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, memorialId);

            byte[] countKey = Helper.Concat(PREFIX_CREATOR_MEMORIAL_COUNT, creator);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }

        [Safe]
        public static BigInteger GetCreatorMemorialAt(UInt160 creator, BigInteger index)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_MEMORIALS, creator),
                (ByteString)index.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        #endregion

        #region 灵位祭拜记录

        private static void AddMemorialTribute(BigInteger memorialId, BigInteger tributeId)
        {
            BigInteger count = GetMemorialTributeCount(memorialId);
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_MEMORIAL_TRIBUTES, (ByteString)memorialId.ToByteArray()),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, tributeId);

            byte[] countKey = Helper.Concat(PREFIX_MEMORIAL_TRIBUTE_COUNT, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }

        [Safe]
        public static BigInteger GetMemorialTributeAt(BigInteger memorialId, BigInteger index)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_MEMORIAL_TRIBUTES, (ByteString)memorialId.ToByteArray()),
                (ByteString)index.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        #endregion

        #region 访客记录

        private static void AddVisitorMemorial(UInt160 visitor, BigInteger memorialId)
        {
            if (HasVisitorVisitedMemorial(visitor, memorialId)) return;

            BigInteger count = GetVisitorMemorialCount(visitor);
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VISITOR_MEMORIALS, visitor),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, memorialId);

            byte[] countKey = Helper.Concat(PREFIX_VISITOR_MEMORIAL_COUNT, visitor);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] visitedKey = Helper.Concat(
                Helper.Concat(PREFIX_VISITED_FLAG, visitor),
                (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, visitedKey, 1);
        }

        [Safe]
        public static bool HasVisitorVisitedMemorial(UInt160 visitor, BigInteger memorialId)
        {
            byte[] visitedKey = Helper.Concat(
                Helper.Concat(PREFIX_VISITED_FLAG, visitor),
                (ByteString)memorialId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, visitedKey) == 1;
        }

        [Safe]
        public static BigInteger GetVisitorMemorialAt(UInt160 visitor, BigInteger index)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VISITOR_MEMORIALS, visitor),
                (ByteString)index.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        #endregion

        #region 讣告栏

        private const int MAX_RECENT_OBITUARIES = 50;

        private static void AddToObituaryBoard(BigInteger memorialId)
        {
            BigInteger count = GetObituaryCount();
            BigInteger nextIndex = count % MAX_RECENT_OBITUARIES;

            byte[] key = Helper.Concat(PREFIX_RECENT_OBITUARIES, (ByteString)nextIndex.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, memorialId);

            Storage.Put(Storage.CurrentContext, PREFIX_OBITUARY_COUNT, count + 1);
        }

        [Safe]
        public static BigInteger GetRecentObituaryAt(BigInteger index)
        {
            byte[] key = Helper.Concat(PREFIX_RECENT_OBITUARIES, (ByteString)index.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger[] GetRecentObituaries()
        {
            BigInteger count = GetObituaryCount();
            int toFetch = count > 10 ? 10 : (int)count;
            BigInteger[] result = new BigInteger[toFetch];

            for (int i = 0; i < toFetch; i++)
            {
                BigInteger index = (count - 1 - i) % MAX_RECENT_OBITUARIES;
                result[i] = GetRecentObituaryAt(index);
            }

            return result;
        }

        #endregion
    }
}
