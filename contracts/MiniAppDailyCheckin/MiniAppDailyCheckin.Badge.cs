using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Badge Logic

        private static void CheckBadges(UInt160 user, BigInteger streak, bool isNewUser)
        {
            if (isNewUser)
                AwardBadge(user, 1, "First Check-in");

            if (streak >= 7)
                AwardBadge(user, 2, "Week Warrior");

            if (streak >= 30)
                AwardBadge(user, 3, "Month Master");

            if (streak >= 100)
                AwardBadge(user, 4, "Centurion");

            if (streak >= 365)
                AwardBadge(user, 5, "Year Legend");

            BigInteger resets = GetUserResets(user);
            if (resets > 0 && streak >= 7)
                AwardBadge(user, 6, "Comeback King");
        }

        #endregion
    }
}
