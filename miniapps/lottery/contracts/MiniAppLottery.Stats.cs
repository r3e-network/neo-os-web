using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Stats Update

        /// <summary>
        /// Update player statistics after ticket purchase.
        /// 
        /// EFFECTS:
        /// - Increments total tickets
        /// - Adds to total spent
        /// - Increments rounds played
        /// - Sets join time for new players
        /// - Awards eligible achievements
        /// </summary>
        /// <param name="player">Player address</param>
        /// <param name="tickets">Number of tickets purchased</param>
        /// <param name="cost">Total cost in GAS</param>
        /// <param name="isNew">Whether this is a new player</param>
        private static void UpdatePlayerStatsOnPurchase(UInt160 player, BigInteger tickets, BigInteger cost, bool isNew)
        {
            PlayerStats stats = GetPlayerStats(player);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalPlayers = TotalPlayers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, totalPlayers + 1);
            }

            stats.TotalTickets += tickets;
            stats.TotalSpent += cost;
            stats.RoundsPlayed += 1;
            stats.LastPlayTime = Runtime.Time;

            StorePlayerStats(player, stats);
            CheckAchievements(player, stats);
        }

        /// <summary>
        /// Update player statistics after winning.
        /// 
        /// EFFECTS:
        /// - Increments total wins
        /// - Adds to total won
        /// - Increments consecutive wins
        /// - Updates best win streak if applicable
        /// - Updates highest win if applicable
        /// - Awards eligible achievements
        /// </summary>
        /// <param name="player">Player address</param>
        /// <param name="prize">Prize amount won</param>
        private static void UpdatePlayerStatsOnWin(UInt160 player, BigInteger prize)
        {
            PlayerStats stats = GetPlayerStats(player);

            stats.TotalWins += 1;
            stats.TotalWon += prize;
            stats.ConsecutiveWins += 1;

            if (stats.ConsecutiveWins > stats.BestWinStreak)
            {
                stats.BestWinStreak = stats.ConsecutiveWins;
            }

            if (prize > stats.HighestWin)
            {
                stats.HighestWin = prize;
            }

            StorePlayerStats(player, stats);
            CheckAchievements(player, stats);
        }

        #endregion
    }
}
