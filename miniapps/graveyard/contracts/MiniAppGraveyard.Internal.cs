using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGraveyard
    {
        #region Internal Helpers

        private static void StoreMemory(BigInteger memoryId, Memory memory)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIES, (ByteString)memoryId.ToByteArray()),
                StdLib.Serialize(memory));
        }

        private static void StoreMemorial(BigInteger memorialId, Memorial memorial)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIALS, (ByteString)memorialId.ToByteArray()),
                StdLib.Serialize(memorial));
        }

        private static void AddUserMemory(UInt160 user, BigInteger memoryId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_MEMORY_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_MEMORIES, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, memoryId);
        }

        private static void UpdateTotalBuried()
        {
            BigInteger total = TotalBuried();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURIED, total + 1);
        }

        private static void UpdateTotalForgotten()
        {
            BigInteger total = TotalForgotten();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_FORGOTTEN, total + 1);
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
