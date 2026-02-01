using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Read Methods

        /// <summary>Get the current active season ID.</summary>
        /// <returns>Current season ID (0 if no seasons started)</returns>
        [Safe]
        public static BigInteger CurrentSeasonId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SEASON_ID);

        /// <summary>Get the total GAS pool across all seasons.</summary>
        /// <returns>Total pool amount in neo-atomic units</returns>
        [Safe]
        public static BigInteger TotalPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POOL);

        /// <summary>Check if a category is active.</summary>
        /// <param name="category">Category name to check</param>
        /// <returns>True if category exists and is active</returns>
        [Safe]
        public static bool IsCategoryActive(string category)
        {
            var key = GetCategoryKey(category);
            var data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data == 1;
        }

        /// <summary>Get nominee details by category and name.</summary>
        /// <param name="category">Nominee category</param>
        /// <param name="nominee">Nominee name</param>
        /// <returns>Nominee struct with all details (empty if not found)</returns>
        [Safe]
        public static Nominee GetNominee(string category, string nominee)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, GetNomineeKey(category, nominee));
            if (data == null) return new Nominee();
            return (Nominee)StdLib.Deserialize(data);
        }

        /// <summary>Get season details by ID.</summary>
        /// <param name="seasonId">Season ID to query</param>
        /// <returns>Season struct with all details (empty if not found)</returns>
        [Safe]
        public static Season GetSeason(BigInteger seasonId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()));
            if (data == null) return new Season();
            return (Season)StdLib.Deserialize(data);
        }

        /// <summary>Get user voting statistics.</summary>
        /// <param name="user">User address</param>
        /// <returns>UserStats struct with voting history (empty if new user)</returns>
        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        /// <summary>Get user's total votes in a specific season.</summary>
        /// <param name="user">User address</param>
        /// <param name="seasonId">Season ID</param>
        /// <returns>Total GAS voted by user in season</returns>
        [Safe]
        public static BigInteger GetUserSeasonVotes(UInt160 user, BigInteger seasonId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_SEASON_VOTES, user),
                (ByteString)seasonId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>Get total number of unique voters.</summary>
        /// <returns>Total voter count</returns>
        [Safe]
        public static BigInteger TotalVoters() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTERS);

        /// <summary>Get total number of nominees.</summary>
        /// <returns>Total nominee count</returns>
        [Safe]
        public static BigInteger TotalNominees() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_NOMINEES);

        /// <summary>Get total number of inducted Hall of Fame members.</summary>
        /// <returns>Total inducted count</returns>
        [Safe]
        public static BigInteger TotalInducted() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_INDUCTED);

        /// <summary>Check if voter has earned a specific badge.</summary>
        /// <param name="voter">Voter address</param>
        /// <param name="badgeType">Badge type identifier</param>
        /// <returns>True if voter has badge</returns>
        [Safe]
        public static bool HasVoterBadge(UInt160 voter, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VOTER_BADGES, voter),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        #endregion
    }
}
