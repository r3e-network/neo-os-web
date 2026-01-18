using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Internal Helpers

        private static void StoreCapsule(BigInteger capsuleId, CapsuleData capsule)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CAPSULES, (ByteString)capsuleId.ToByteArray()),
                StdLib.Serialize(capsule));
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        private static void AddUserCapsule(UInt160 user, BigInteger capsuleId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_CAPSULE_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_CAPSULES, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, capsuleId);
        }

        private static void RemoveUserCapsule(UInt160 user, BigInteger capsuleId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_CAPSULE_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, countKey, count - 1);
            }
        }

        private static void UpdateCategoryCount(BigInteger category, BigInteger delta)
        {
            byte[] key = Helper.Concat(PREFIX_CATEGORY_COUNT, (ByteString)category.ToByteArray());
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, count + delta);
        }

        #endregion
    }
}
