using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Storage Setters

        private static void SetUserStreak(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserHighestStreak(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserLastCheckin(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserUnclaimed(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserClaimed(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CLAIMED, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserCheckins(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CHECKINS, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        #endregion
    }
}
