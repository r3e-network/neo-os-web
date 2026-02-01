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
        #region Read Methods

        /// <summary>Get the current active round ID.</summary>
        /// <returns>Current round ID (0 if no rounds started)</returns>
        [Safe]
        public static BigInteger CurrentRound() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND);

        /// <summary>Get the current prize pool amount.</summary>
        /// <returns>Prize pool in GAS (neo-atomic units)</returns>
        [Safe]
        public static BigInteger PrizePool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        /// <summary>Get total tickets sold across all rounds.</summary>
        /// <returns>Total ticket count</returns>
        [Safe]
        public static BigInteger TotalTickets() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TICKET_COUNT);

        /// <summary>Check if a draw is currently pending.</summary>
        /// <returns>True if draw is in progress</returns>
        [Safe]
        public static bool IsDrawPending() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DRAW_PENDING) == 1;

        /// <summary>Get total number of unique players.</summary>
        /// <returns>Total player count</returns>
        [Safe]
        public static BigInteger TotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        /// <summary>Get total prizes distributed across all rounds.</summary>
        /// <returns>Total prizes in GAS (neo-atomic units)</returns>
        [Safe]
        public static BigInteger TotalPrizesDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PRIZES);

        /// <summary>Get current rollover amount for next round.</summary>
        /// <returns>Rollover amount in GAS (neo-atomic units)</returns>
        [Safe]
        public static BigInteger RolloverAmount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROLLOVER);

        #endregion
    }
}
