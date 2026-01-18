using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Platform Stats

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["currentRound"] = CurrentRoundId();
            stats["totalKeysSold"] = TotalKeysSold();
            stats["totalPotDistributed"] = TotalPotDistributed();
            stats["totalPlayers"] = TotalPlayers();
            stats["totalRounds"] = TotalRounds();

            stats["platformFeeBps"] = PLATFORM_FEE_BPS;
            stats["winnerShareBps"] = WINNER_SHARE_BPS;
            stats["dividendShareBps"] = DIVIDEND_SHARE_BPS;
            stats["baseKeyPrice"] = BASE_KEY_PRICE;
            stats["timeAddedPerKeySeconds"] = TIME_ADDED_PER_KEY_SECONDS;
            stats["initialDurationSeconds"] = INITIAL_DURATION_SECONDS;
            stats["maxDurationSeconds"] = MAX_DURATION_SECONDS;

            BigInteger currentRoundId = CurrentRoundId();
            if (currentRoundId > 0)
            {
                Round currentRound = GetRound(currentRoundId);
                stats["currentRoundPot"] = currentRound.Pot;
                stats["currentRoundKeys"] = currentRound.TotalKeys;
                stats["currentRoundActive"] = currentRound.Active;
                if (currentRound.Active)
                {
                    BigInteger remaining = currentRound.EndTime - Runtime.Time;
                    stats["currentRoundRemainingTime"] = remaining > 0 ? remaining : 0;
                }
            }

            return stats;
        }

        #endregion
    }
}
