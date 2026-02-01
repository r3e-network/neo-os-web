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

        /// <summary>Build storage key for a category.</summary>
        /// <param name="category">Category name</param>
        /// <returns>Storage key byte string</returns>
        private static ByteString GetCategoryKey(string category)
        {
            return Helper.Concat((ByteString)PREFIX_CATEGORY, (ByteString)category);
        }

        /// <summary>Build storage key for a nominee.</summary>
        /// <param name="category">Nominee category</param>
        /// <param name="nominee">Nominee name</param>
        /// <returns>Storage key byte string</returns>
        private static ByteString GetNomineeKey(string category, string nominee)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_NOMINEES, (ByteString)category),
                (ByteString)nominee);
        }

        /// <summary>Serialize and store nominee data.</summary>
        /// <param name="category">Nominee category</param>
        /// <param name="nominee">Nominee name</param>
        /// <param name="data">Nominee struct to store</param>
        private static void StoreNominee(string category, string nominee, Nominee data)
        {
            Storage.Put(Storage.CurrentContext, GetNomineeKey(category, nominee),
                StdLib.Serialize(data));
        }

        /// <summary>Serialize and store season data.</summary>
        /// <param name="seasonId">Season ID</param>
        /// <param name="season">Season struct to store</param>
        private static void StoreSeason(BigInteger seasonId, Season season)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()),
                StdLib.Serialize(season));
        }

        /// <summary>Serialize and store user statistics.</summary>
        /// <param name="user">User address</param>
        /// <param name="stats">UserStats struct to store</param>
        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
