using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformVestingContract
    {
        private static byte[] StreamKey(string appId, BigInteger streamId) =>
            AppKey(appId, PREFIX_STREAM, streamId);

        private static byte[] AccountKey(string appId, byte[] prefix, UInt160 account) =>
            (byte[])Helper.Concat((ByteString)AppKey(appId, prefix), (ByteString)(byte[])account);

        private static byte[] IndexKey(string appId, byte[] prefix, UInt160 account, BigInteger index) =>
            (byte[])Helper.Concat((ByteString)AccountKey(appId, prefix, account), (ByteString)index.ToByteArray());
    }
}
