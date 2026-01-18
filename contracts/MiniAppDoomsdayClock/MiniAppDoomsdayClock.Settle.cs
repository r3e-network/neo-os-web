using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Settle Round

        private static void SettleRound(BigInteger roundId)
        {
            Round round = GetRound(roundId);
            if (!round.Active || round.Settled) return;

            UInt160 winner = round.LastBuyer;
            BigInteger winnerPrize = round.Pot * WINNER_SHARE_BPS / 10000;

            round.Active = false;
            round.Settled = true;
            round.Winner = winner;
            round.WinnerPrize = winnerPrize;
            StoreRound(roundId, round);

            // Transfer prize to winner
            if (winner != UInt160.Zero && winnerPrize > 0)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize);

                // Update winner stats
                PlayerStats stats = GetPlayerStats(winner);
                stats.TotalWon += winnerPrize;
                stats.RoundsWon += 1;
                StorePlayerStats(winner, stats);
            }

            // Update total distributed
            BigInteger totalDistributed = TotalPotDistributed();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POT_DISTRIBUTED, totalDistributed + round.Pot);

            OnDoomsdayWinner(winner, winnerPrize, roundId);
        }

        #endregion
    }
}
