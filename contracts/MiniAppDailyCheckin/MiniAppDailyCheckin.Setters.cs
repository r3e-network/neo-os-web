using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Storage Setters

        private static void SetUserStreak(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_STREAK, user), value);
        }

        private static void SetUserHighestStreak(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_HIGHEST, user), value);
        }

        private static void SetUserLastCheckin(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_LAST_CHECKIN, user), value);
        }

        private static void SetUserUnclaimed(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_UNCLAIMED, user), value);
        }

        private static void SetUserClaimed(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_CLAIMED, user), value);
        }

        private static void SetUserCheckins(UInt160 user, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, Key(PREFIX_USER_CHECKINS, user), value);
        }

        #endregion
    }
}
