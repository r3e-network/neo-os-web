using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalBurned"] = TotalBurned();
            stats["rewardPool"] = RewardPool();
            stats["totalParticipants"] = TotalParticipants();
            stats["totalBurners"] = TotalBurners();
            stats["currentSeason"] = CurrentSeasonId();

            // Configuration info
            stats["minBurn"] = MIN_BURN;
            stats["tier1Threshold"] = TIER1_THRESHOLD;
            stats["tier2Threshold"] = TIER2_THRESHOLD;
            stats["tier3Threshold"] = TIER3_THRESHOLD;
            stats["seasonDurationSeconds"] = SEASON_DURATION_SECONDS;
            stats["streakWindowSeconds"] = STREAK_WINDOW_SECONDS;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;

            // Current season info
            BigInteger seasonId = CurrentSeasonId();
            if (seasonId > 0)
            {
                Season season = GetSeason(seasonId);
                stats["currentSeasonBurned"] = season.TotalBurned;
                stats["currentSeasonParticipants"] = season.TotalParticipants;
                stats["currentSeasonActive"] = season.Active;
                if (season.Active && season.EndTime > 0)
                {
                    BigInteger remaining = season.EndTime - Runtime.Time;
                    stats["currentSeasonRemainingTime"] = remaining > 0 ? remaining : 0;
                }
            }

            return stats;
        }

        [Safe]
        private static BigInteger GetSeasonTotalPoints(BigInteger seasonId)
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_POINTS, (ByteString)seasonId.ToByteArray()));
        }

        #endregion
    }
}
