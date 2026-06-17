using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Read-only
        [Safe]
        public static BigInteger CurrentSeason() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SEASON_ID);

        [Safe]
        public static BigInteger SeasonEnd() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SEASON_END);

        [Safe]
        public static BigInteger RewardPool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        /// <summary>Total burned into the current season pool (== RewardPool).</summary>
        [Safe]
        public static BigInteger TotalBurned() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        [Safe]
        public static BigInteger BurnCount() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BURN_COUNT);

        [Safe]
        public static BigInteger UserBurned(UInt160 player)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger seasonId = (BigInteger)Storage.Get(ctx, PREFIX_SEASON_ID);
            byte[] userKey = Helper.Concat(Helper.Concat(PREFIX_USER_BURNED, (byte[])(ByteString)seasonId), (byte[])player);
            return (BigInteger)Storage.Get(ctx, userKey);
        }

        [Safe]
        public static UInt160 TopBurner()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_TOP_BURNER);
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        [Safe]
        public static BigInteger TopBurned() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOP_BURNED);

        [Safe]
        public static BigInteger CreditOf(UInt160 player) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_CREDIT, (byte[])player));

        [Safe]
        public static BigInteger MinBurn() => MIN_BURN;

        [Safe]
        public static BigInteger MaxBurn() => MAX_BURN;

        [Safe]
        public static BigInteger SeasonDuration() => SEASON_DURATION;
        #endregion
    }
}
