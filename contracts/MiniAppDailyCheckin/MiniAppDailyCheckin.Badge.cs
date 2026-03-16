using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Badge Logic

        private static void CheckBadges(UInt160 user, BigInteger streak, bool isNewUser)
        {
            BigInteger totalCheckins = GetUserCheckins(user);

            if (isNewUser)
                AwardBadge(user, 1, "First Check-in");

            if (streak >= 7)
                AwardBadge(user, 2, "Week Warrior");

            if (streak >= STREAK_RESET_DAYS)
                AwardBadge(user, 3, "Fortnight Finisher");

            if (totalCheckins >= 30)
                AwardBadge(user, 4, "Habit Builder");

            if (totalCheckins >= 100)
                AwardBadge(user, 5, "Loyalty Legend");

            BigInteger resets = GetUserResets(user);
            if (resets > 0 && streak >= 7)
                AwardBadge(user, 6, "Comeback King");
        }

        #endregion
    }
}
