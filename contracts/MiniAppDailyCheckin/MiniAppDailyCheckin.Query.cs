using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Query Methods

        [Safe]
        public static BigInteger GetUserJoinTime(UInt160 user)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, Key(PREFIX_USER_JOIN_TIME, user));
        }

        [Safe]
        public static BigInteger CalculateNextRewardDay(BigInteger currentStreak)
        {
            if (currentStreak < 7) return 7;
            if (currentStreak < STREAK_RESET_DAYS) return STREAK_RESET_DAYS;
            return 7;
        }

        #endregion
    }
}
