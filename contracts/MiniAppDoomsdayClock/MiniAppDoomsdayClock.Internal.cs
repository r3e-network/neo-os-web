using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Internal Helpers

        private static void StoreRound(BigInteger roundId, Round round)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ROUNDS, (ByteString)roundId.ToByteArray()),
                StdLib.Serialize(round));
        }

        private static void StorePlayerStats(UInt160 player, PlayerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLAYER_STATS, player),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
