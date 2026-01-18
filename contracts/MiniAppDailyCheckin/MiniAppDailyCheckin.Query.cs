using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Query Methods

        [Safe]
        public static BigInteger GetUserJoinTime(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_JOIN_TIME, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger CalculateNextRewardDay(BigInteger currentStreak)
        {
            if (currentStreak < 7) return 7;
            BigInteger nextMultiple = ((currentStreak / 7) + 1) * 7;
            return nextMultiple;
        }

        #endregion
    }
}
