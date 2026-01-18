using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGardenOfNeo
    {
        #region Internal Helpers

        private static void StorePlant(BigInteger plantId, PlantData plant)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLANTS, (ByteString)plantId.ToByteArray()),
                StdLib.Serialize(plant));
        }

        private static void StoreGarden(BigInteger gardenId, GardenData garden)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_GARDENS, (ByteString)gardenId.ToByteArray()),
                StdLib.Serialize(garden));
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        private static void AddUserPlant(UInt160 user, BigInteger plantId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_PLANT_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_PLANTS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, plantId);
        }

        #endregion
    }
}
