using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region User Stats Getters

        [Safe]
        public static BigInteger GetUserStreak(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_STREAK, user));
        }

        [Safe]
        public static BigInteger GetUserHighestStreak(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_HIGHEST, user));
        }

        [Safe]
        public static BigInteger GetUserLastCheckin(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_LAST_CHECKIN, user));
        }

        [Safe]
        public static BigInteger GetUserUnclaimed(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_UNCLAIMED, user));
        }

        [Safe]
        public static BigInteger GetUserClaimed(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_CLAIMED, user));
        }

        [Safe]
        public static BigInteger GetUserCheckins(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_CHECKINS, user));
        }

        [Safe]
        public static object[] GetUserStats(UInt160 user)
        {
            return new object[] {
                GetUserStreak(user),
                GetUserHighestStreak(user),
                GetUserLastCheckin(user),
                GetUserUnclaimed(user),
                GetUserClaimed(user),
                GetUserCheckins(user)
            };
        }

        #endregion
    }
}
