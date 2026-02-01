using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Internal Helpers

        private static void StoreDeveloper(BigInteger devId, DeveloperData dev)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DEVELOPERS, (ByteString)devId.ToByteArray()),
                StdLib.Serialize(dev));
        }

        private static void StoreTip(BigInteger tipId, TipData tip)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TIPS, (ByteString)tipId.ToByteArray()),
                StdLib.Serialize(tip));
        }

        private static void StoreTipperStats(UInt160 tipper, TipperStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TIPPER_STATS, tipper),
                StdLib.Serialize(stats));
        }

        #endregion
    }
}
