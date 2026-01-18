using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Award Achievement

        private static void AwardAchievement(UInt160 player, BigInteger achievementId, string name)
        {
            if (HasAchievement(player, achievementId)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_ACHIEVEMENTS, player),
                (ByteString)achievementId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            PlayerStats stats = GetPlayerStats(player);
            stats.AchievementCount += 1;
            StorePlayerStats(player, stats);

            OnAchievementUnlocked(player, achievementId, name);
        }

        #endregion
    }
}
