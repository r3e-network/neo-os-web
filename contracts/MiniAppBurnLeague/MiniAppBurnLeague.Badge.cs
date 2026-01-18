using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Badge Logic

        /// <summary>
        /// Check and award burner badges based on achievements.
        /// Badges: 1=FirstBurn, 2=ActiveBurner(10 burns), 3=WhaleBurner(100 GAS),
        ///         4=StreakMaster(7 day streak), 5=SeasonVeteran(5 seasons), 6=Tier3Elite(10 tier3 burns)
        /// </summary>
        private static void CheckBurnerBadges(UInt160 burner)
        {
            BurnerStats stats = GetBurnerStats(burner);

            // Badge 1: First Burn
            if (stats.BurnCount >= 1)
            {
                AwardBurnerBadge(burner, 1, "First Burn");
            }

            // Badge 2: Active Burner (10+ burns)
            if (stats.BurnCount >= 10)
            {
                AwardBurnerBadge(burner, 2, "Active Burner");
            }

            // Badge 3: Whale Burner (100+ GAS total burned)
            if (stats.TotalBurned >= 10000000000) // 100 GAS
            {
                AwardBurnerBadge(burner, 3, "Whale Burner");
            }

            // Badge 4: Streak Master (7+ day streak)
            if (stats.LongestStreak >= 7)
            {
                AwardBurnerBadge(burner, 4, "Streak Master");
            }

            // Badge 5: Season Veteran (5+ seasons participated)
            if (stats.SeasonsParticipated >= 5)
            {
                AwardBurnerBadge(burner, 5, "Season Veteran");
            }

            // Badge 6: Tier 3 Elite (10+ tier 3 burns)
            if (stats.Tier3Burns >= 10)
            {
                AwardBurnerBadge(burner, 6, "Tier 3 Elite");
            }
        }

        private static void AwardBurnerBadge(UInt160 burner, BigInteger badgeType, string badgeName)
        {
            if (HasBurnerBadge(burner, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_BURNER_BADGES, burner),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            BurnerStats stats = GetBurnerStats(burner);
            stats.BadgeCount += 1;
            StoreBurnerStats(burner, stats);

            OnBurnerBadgeEarned(burner, badgeType, badgeName);
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            BigInteger seasonId = CurrentSeasonId();
            if (seasonId > 0)
            {
                Season season = GetSeason(seasonId);
                if (season.Active && Runtime.Time >= season.EndTime)
                {
                    EndSeason();
                }
            }
        }

        #endregion
    }
}
