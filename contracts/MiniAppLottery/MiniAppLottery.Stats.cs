using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Stats Update

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
