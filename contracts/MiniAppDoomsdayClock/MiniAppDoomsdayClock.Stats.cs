using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Stats Update Methods

        private static void UpdatePlayerKeys(UInt160 player, BigInteger roundId, BigInteger keyCount)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_KEYS, player),
                (ByteString)roundId.ToByteArray());
            BigInteger currentKeys = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, currentKeys + keyCount);
        }

        private static void UpdatePlayerStats(UInt160 player, BigInteger keyCount, BigInteger spent)
        {
            PlayerStats stats = GetPlayerStats(player);

            bool isNewPlayer = stats.JoinTime == 0;
            if (isNewPlayer)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalPlayers = TotalPlayers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, totalPlayers + 1);
            }

            stats.TotalKeysOwned += keyCount;
            stats.TotalSpent += spent;
            stats.RoundsPlayed += 1;
            stats.LastActivityTime = Runtime.Time;

            if (spent > stats.HighestSinglePurchase)
            {
                stats.HighestSinglePurchase = spent;
            }

            StorePlayerStats(player, stats);
            CheckPlayerBadges(player);
        }

        #endregion
    }
}
