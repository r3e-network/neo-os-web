using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMillionPieceMap
    {
        #region Internal Helpers

        private static ByteString GetPieceKey(BigInteger x, BigInteger y)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_PIECES, (ByteString)x.ToByteArray()),
                (ByteString)y.ToByteArray());
        }

        private static void StorePiece(BigInteger x, BigInteger y, PieceData piece)
        {
            Storage.Put(Storage.CurrentContext, GetPieceKey(x, y), StdLib.Serialize(piece));
        }

        private static void StoreRegion(BigInteger regionId, RegionData region)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_REGIONS, (ByteString)regionId.ToByteArray()),
                StdLib.Serialize(region));
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        private static BigInteger GetRegionId(BigInteger x, BigInteger y)
        {
            BigInteger regionX = x / REGION_SIZE;
            BigInteger regionY = y / REGION_SIZE;
            return regionY * (MAP_WIDTH / REGION_SIZE) + regionX;
        }

        private static void AddUserPiece(UInt160 user, BigInteger x, BigInteger y)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_PIECE_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_PIECES, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, GetPieceKey(x, y));
        }

        private static void RemoveUserPiece(UInt160 user, BigInteger x, BigInteger y)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_PIECE_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, countKey, count - 1);
            }
        }

        #endregion
    }
}
