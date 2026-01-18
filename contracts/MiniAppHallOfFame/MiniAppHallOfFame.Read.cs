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

        [Safe]
        public static BigInteger CurrentSeasonId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SEASON_ID);

        [Safe]
        public static BigInteger TotalPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POOL);

        [Safe]
        public static bool IsCategoryActive(string category)
        {
            var key = GetCategoryKey(category);
            var data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data == 1;
        }

        [Safe]
        public static Nominee GetNominee(string category, string nominee)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, GetNomineeKey(category, nominee));
            if (data == null) return new Nominee();
            return (Nominee)StdLib.Deserialize(data);
        }

        [Safe]
        public static Season GetSeason(BigInteger seasonId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()));
            if (data == null) return new Season();
            return (Season)StdLib.Deserialize(data);
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserSeasonVotes(UInt160 user, BigInteger seasonId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_SEASON_VOTES, user),
                (ByteString)seasonId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger TotalVoters() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VOTERS);

        [Safe]
        public static BigInteger TotalNominees() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_NOMINEES);

        [Safe]
        public static BigInteger TotalInducted() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_INDUCTED);

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
