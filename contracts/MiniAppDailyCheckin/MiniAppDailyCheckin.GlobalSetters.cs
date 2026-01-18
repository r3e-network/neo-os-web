using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Global Stats Setters

        private static void IncrementTotalUsers()
        {
            BigInteger current = TotalUsers();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, current + 1);
        }

        private static void IncrementTotalCheckins()
        {
            BigInteger current = TotalCheckins();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS, current + 1);
        }

        private static void IncrementTotalRewarded(BigInteger amount)
        {
            BigInteger current = TotalRewarded();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDED, current + amount);
        }

        private static void SetUserJoinTime(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_JOIN_TIME, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void IncrementUserResets(UInt160 user)
        {
            BigInteger current = GetUserResets(user);
            byte[] key = Helper.Concat(PREFIX_USER_RESETS, user);
            Storage.Put(Storage.CurrentContext, key, current + 1);
        }

        #endregion
    }
}
