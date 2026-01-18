using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Internal Helpers

        private static ByteString GetCategoryKey(string category)
        {
            return Helper.Concat((ByteString)PREFIX_CATEGORY, (ByteString)category);
        }

        private static ByteString GetNomineeKey(string category, string nominee)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_NOMINEES, (ByteString)category),
                (ByteString)nominee);
        }

        private static void StoreNominee(string category, string nominee, Nominee data)
        {
            Storage.Put(Storage.CurrentContext, GetNomineeKey(category, nominee),
                StdLib.Serialize(data));
        }

        private static void StoreSeason(BigInteger seasonId, Season season)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()),
                StdLib.Serialize(season));
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
