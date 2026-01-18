using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Internal Helpers

        private static void StoreDeposit(UInt160 depositor, Deposit deposit)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DEPOSITS, depositor),
                StdLib.Serialize(deposit));
        }

        private static void StoreEpoch(BigInteger epochId, Epoch epoch)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_EPOCHS, (ByteString)epochId.ToByteArray()),
                StdLib.Serialize(epoch));
        }

        private static void StoreDepositorStats(UInt160 depositor, DepositorStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DEPOSITOR_STATS, depositor),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
