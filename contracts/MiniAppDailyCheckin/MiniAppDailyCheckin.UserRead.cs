using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region User Stats Getters

        [Safe]
        public static BigInteger GetUserStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserHighestStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserLastCheckin(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserUnclaimed(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserClaimed(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CLAIMED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserCheckins(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CHECKINS, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
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
