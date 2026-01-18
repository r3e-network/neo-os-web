using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Internal Helpers

        private static void StoreBet(BigInteger betId, BetData bet)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BETS, (ByteString)betId.ToByteArray()),
                StdLib.Serialize(bet));
        }

        private static void AddUserBet(UInt160 player, BigInteger betId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_BET_COUNT, player);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);

            if (count == 0)
            {
                BigInteger totalPlayers = GetTotalPlayers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, totalPlayers + 1);
            }

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BETS, player),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, betId);

            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }

        private static void StorePlayerStats(UInt160 player, PlayerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLAYER_STATS, player),
                StdLib.Serialize(stats));
        }

        private static BigInteger ToPositiveInteger(byte[] bytes)
        {
            byte[] unsigned = new byte[bytes.Length + 1];
            for (int i = 0; i < bytes.Length; i++)
            {
                unsigned[i] = bytes[i];
            }
            return new BigInteger(unsigned);
        }

        #endregion
    }
}
