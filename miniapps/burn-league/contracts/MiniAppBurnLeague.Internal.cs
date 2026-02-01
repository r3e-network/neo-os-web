using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Internal Helpers

        private static void StoreSeason(BigInteger seasonId, Season season)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SEASONS, (ByteString)seasonId.ToByteArray()),
                StdLib.Serialize(season));
        }

        private static BigInteger CalculatePoints(BigInteger amount)
        {
            if (amount >= TIER3_THRESHOLD)
                return amount * 2;
            if (amount >= TIER2_THRESHOLD)
                return amount * 15 / 10;
            return amount;
        }

        private static void StoreUserStreak(UInt160 user, UserStreak streak)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STREAK, user),
                StdLib.Serialize(streak));
        }

        private static void StoreBurnerStats(UInt160 burner, BurnerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BURNER_STATS, burner),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
