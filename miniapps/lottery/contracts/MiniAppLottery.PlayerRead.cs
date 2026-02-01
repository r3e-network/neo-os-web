using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Player Read Methods

        [Safe]
        public static PlayerStats GetPlayerStats(UInt160 player)
        {
            byte[] key = GetPlayerStatsKey(player);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_TICKETS));
            if (data == null) return new PlayerStats();

            return new PlayerStats
            {
                TotalTickets = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_TICKETS)),
                TotalSpent = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_SPENT)),
                TotalWins = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_WINS)),
                TotalWon = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_WON)),
                RoundsPlayed = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_ROUNDS_PLAYED)),
                ConsecutiveWins = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_CONSECUTIVE_WINS)),
                BestWinStreak = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_BEST_STREAK)),
                HighestWin = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_HIGHEST_WIN)),
                AchievementCount = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_ACHIEVEMENTS)),
                JoinTime = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_JOIN_TIME)),
                LastPlayTime = GetBigInteger(Helper.Concat(key, PLAYER_STATS_FIELD_LAST_PLAY))
            };
        }

        [Safe]
        public static RoundData GetRoundData(BigInteger roundId)
        {
            byte[] key = GetRoundDataKey(roundId);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_ID));
            if (data == null) return new RoundData();

            return new RoundData
            {
                Id = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_ID)),
                TotalTickets = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_TOTAL_TICKETS)),
                PrizePool = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_PRIZE_POOL)),
                ParticipantCount = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_PARTICIPANT_COUNT)),
                Winner = GetUInt160(Helper.Concat(key, ROUND_DATA_FIELD_WINNER)),
                WinnerPrize = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_WINNER_PRIZE)),
                StartTime = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_START_TIME)),
                EndTime = GetBigInteger(Helper.Concat(key, ROUND_DATA_FIELD_END_TIME)),
                Completed = GetBool(Helper.Concat(key, ROUND_DATA_FIELD_COMPLETED))
            };
        }

        [Safe]
        public static bool HasAchievement(UInt160 player, BigInteger achievementId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_ACHIEVEMENTS, player),
                (ByteString)achievementId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static BigInteger GetPlayerTickets(UInt160 player, BigInteger roundId)
        {
            byte[] ticketKey = Helper.Concat(PREFIX_TICKETS, player);
            ticketKey = Helper.Concat(ticketKey, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, ticketKey);
        }

        #endregion
    }
}
