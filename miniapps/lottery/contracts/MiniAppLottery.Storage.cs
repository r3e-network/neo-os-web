using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Storage Helpers
        // Player stats field identifiers (0x01-0x0B)
        private static readonly byte[] PLAYER_STATS_FIELD_TOTAL_TICKETS = new byte[] { 0x01 };
        private static readonly byte[] PLAYER_STATS_FIELD_TOTAL_SPENT = new byte[] { 0x02 };
        private static readonly byte[] PLAYER_STATS_FIELD_TOTAL_WINS = new byte[] { 0x03 };
        private static readonly byte[] PLAYER_STATS_FIELD_TOTAL_WON = new byte[] { 0x04 };
        private static readonly byte[] PLAYER_STATS_FIELD_ROUNDS_PLAYED = new byte[] { 0x05 };
        private static readonly byte[] PLAYER_STATS_FIELD_CONSECUTIVE_WINS = new byte[] { 0x06 };
        private static readonly byte[] PLAYER_STATS_FIELD_BEST_STREAK = new byte[] { 0x07 };
        private static readonly byte[] PLAYER_STATS_FIELD_HIGHEST_WIN = new byte[] { 0x08 };
        private static readonly byte[] PLAYER_STATS_FIELD_ACHIEVEMENTS = new byte[] { 0x09 };
        private static readonly byte[] PLAYER_STATS_FIELD_JOIN_TIME = new byte[] { 0x0A };
        private static readonly byte[] PLAYER_STATS_FIELD_LAST_PLAY = new byte[] { 0x0B };

        // Round data field identifiers (0x01-0x09)
        private static readonly byte[] ROUND_DATA_FIELD_ID = new byte[] { 0x01 };
        private static readonly byte[] ROUND_DATA_FIELD_TOTAL_TICKETS = new byte[] { 0x02 };
        private static readonly byte[] ROUND_DATA_FIELD_PRIZE_POOL = new byte[] { 0x03 };
        private static readonly byte[] ROUND_DATA_FIELD_PARTICIPANT_COUNT = new byte[] { 0x04 };
        private static readonly byte[] ROUND_DATA_FIELD_WINNER = new byte[] { 0x05 };
        private static readonly byte[] ROUND_DATA_FIELD_WINNER_PRIZE = new byte[] { 0x06 };
        private static readonly byte[] ROUND_DATA_FIELD_START_TIME = new byte[] { 0x07 };
        private static readonly byte[] ROUND_DATA_FIELD_END_TIME = new byte[] { 0x08 };
        private static readonly byte[] ROUND_DATA_FIELD_COMPLETED = new byte[] { 0x09 };

        /// <summary>Build storage key for player statistics.</summary>
        /// <param name="player">Player address</param>
        /// <returns>Storage key bytes</returns>
        private static byte[] GetPlayerStatsKey(UInt160 player) =>
            Helper.Concat(PREFIX_PLAYER_STATS, player);

        /// <summary>Build storage key for round data.</summary>
        /// <param name="roundId">Round ID</param>
        /// <returns>Storage key bytes</returns>
        private static byte[] GetRoundDataKey(BigInteger roundId) =>
            Helper.Concat(PREFIX_ROUND_DATA, (ByteString)roundId.ToByteArray());

        /// <summary>Get BigInteger from storage.</summary>
        /// <param name="key">Storage key</param>
        /// <returns>Stored value or 0 if not found</returns>
        private static BigInteger GetBigInteger(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>Get UInt160 address from storage.</summary>
        /// <param name="key">Storage key</param>
        /// <returns>Stored address or Zero if not found</returns>
        private static UInt160 GetUInt160(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        /// <summary>Get boolean from storage.</summary>
        /// <param name="key">Storage key</param>
        /// <returns>True if value exists and is non-zero</returns>
        private static bool GetBool(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data != 0;
        }

        /// <summary>Store boolean value.</summary>
        /// <param name="key">Storage key</param>
        /// <param name="value">Boolean value</param>
        private static void PutBool(byte[] key, bool value)
        {
            Storage.Put(Storage.CurrentContext, key, value ? 1 : 0);
        }

        /// <summary>Get participant count for a round.</summary>
        /// <param name="roundId">Round ID</param>
        /// <returns>Number of participants</returns>
        private static BigInteger GetParticipantCount(BigInteger roundId)
        {
            byte[] key = Helper.Concat(PREFIX_PARTICIPANT_COUNT, (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>Set participant count for a round.</summary>
        /// <param name="roundId">Round ID</param>
        /// <param name="count">Participant count</param>
        private static void SetParticipantCount(BigInteger roundId, BigInteger count)
        {
            byte[] key = Helper.Concat(PREFIX_PARTICIPANT_COUNT, (ByteString)roundId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, count);
        }

        /// <summary>Store player statistics.</summary>
        /// <param name="player">Player address</param>
        /// <param name="stats">Player statistics</param>
        private static void StorePlayerStats(UInt160 player, PlayerStats stats)
        {
            byte[] key = GetPlayerStatsKey(player);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_TICKETS), stats.TotalTickets);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_SPENT), stats.TotalSpent);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_WINS), stats.TotalWins);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_TOTAL_WON), stats.TotalWon);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_ROUNDS_PLAYED), stats.RoundsPlayed);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_CONSECUTIVE_WINS), stats.ConsecutiveWins);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_BEST_STREAK), stats.BestWinStreak);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_HIGHEST_WIN), stats.HighestWin);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_ACHIEVEMENTS), stats.AchievementCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_JOIN_TIME), stats.JoinTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, PLAYER_STATS_FIELD_LAST_PLAY), stats.LastPlayTime);
        }

        /// <summary>Store round data.</summary>
        /// <param name="roundId">Round ID</param>
        /// <param name="round">Round data</param>
        private static void StoreRoundData(BigInteger roundId, RoundData round)
        {
            byte[] key = GetRoundDataKey(roundId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_ID), round.Id);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_TOTAL_TICKETS), round.TotalTickets);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_PRIZE_POOL), round.PrizePool);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_PARTICIPANT_COUNT), round.ParticipantCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_WINNER), round.Winner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_WINNER_PRIZE), round.WinnerPrize);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_START_TIME), round.StartTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, ROUND_DATA_FIELD_END_TIME), round.EndTime);
            PutBool(Helper.Concat(key, ROUND_DATA_FIELD_COMPLETED), round.Completed);
        }

        #endregion
    }
}
