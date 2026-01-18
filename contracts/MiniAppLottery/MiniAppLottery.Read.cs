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

        [Safe]
        public static BigInteger CurrentRound() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND);

        [Safe]
        public static BigInteger PrizePool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        [Safe]
        public static BigInteger TotalTickets() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TICKET_COUNT);

        [Safe]
        public static bool IsDrawPending() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DRAW_PENDING) == 1;

        [Safe]
        public static BigInteger TotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        [Safe]
        public static BigInteger TotalPrizesDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PRIZES);

        [Safe]
        public static BigInteger RolloverAmount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROLLOVER);

        #endregion
    }
}
