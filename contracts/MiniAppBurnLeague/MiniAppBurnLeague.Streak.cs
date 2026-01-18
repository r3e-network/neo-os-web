using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Streak Methods

        private static BigInteger ApplyStreakBonus(UInt160 user, BigInteger points)
        {
            UserStreak streak = GetUserStreak(user);
            BigInteger now = Runtime.Time;

            if (streak.LastBurnTime > 0 && now <= streak.LastBurnTime + STREAK_WINDOW_SECONDS)
            {
                streak.CurrentStreak += 1;
                if (streak.CurrentStreak > streak.LongestStreak)
                    streak.LongestStreak = streak.CurrentStreak;

                BigInteger bonus = streak.CurrentStreak > 10 ? 10 : streak.CurrentStreak;
                points = points * (100 + bonus) / 100;
                OnStreakBonus(user, streak.CurrentStreak, 100 + bonus);
            }
            else
            {
                streak.CurrentStreak = 1;
            }

            streak.LastBurnTime = now;
            StoreUserStreak(user, streak);
            return points;
        }

        #endregion
    }
}
