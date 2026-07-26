using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;

namespace NeoMiniAppPlatform.Contracts
{
    internal static class MiniAppStorageKeys
    {
        internal static byte[] AppKey(string appId, byte[] prefix) =>
            (byte[])Helper.Concat((ByteString)appId, (ByteString)prefix);

        internal static byte[] AppKey(string appId, byte[] prefix, BigInteger id) =>
            (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix),
                (ByteString)id.ToByteArray());

        internal static byte[] AppKey(string appId, byte[] prefix, UInt160 account) =>
            (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix),
                (ByteString)(byte[])account);

        internal static ByteString AppKeyValue(string appId, byte[] prefix) =>
            Helper.Concat((ByteString)appId, (ByteString)prefix);

        internal static ByteString AppKeyValue(string appId, byte[] prefix, BigInteger id) =>
            Helper.Concat(AppKeyValue(appId, prefix), (ByteString)id.ToByteArray());

        internal static ByteString AppKeyValue(string appId, byte[] prefix, UInt160 account) =>
            Helper.Concat(AppKeyValue(appId, prefix), (ByteString)(byte[])account);

        internal static ByteString LengthDelimitedId(BigInteger id)
        {
            byte[] raw = id.ToByteArray();
            ExecutionEngine.Assert(raw.Length <= 255, "id segment too large");
            return Helper.Concat((ByteString)new byte[] { (byte)raw.Length }, (ByteString)raw);
        }

        internal static ByteString HashedAppKey(string appId, byte[] prefix) =>
            Helper.Concat(CryptoLib.Sha256((ByteString)appId), (ByteString)prefix);

        internal static ByteString HashedAppKey(string appId, byte[] prefix, BigInteger id) =>
            Helper.Concat(HashedAppKey(appId, prefix), (ByteString)id.ToByteArray());

        internal static ByteString HashedAppKey(string appId, byte[] prefix, UInt160 account) =>
            Helper.Concat(HashedAppKey(appId, prefix), (ByteString)(byte[])account);

        internal static ByteString HashedAppKey(
            string appId,
            byte[] prefix,
            BigInteger id,
            UInt160 account) =>
            Helper.Concat(
                Helper.Concat(HashedAppKey(appId, prefix), LengthDelimitedId(id)),
                (ByteString)(byte[])account);

        internal static ByteString HashedAppKey(
            string appId,
            byte[] prefix,
            BigInteger id1,
            BigInteger id2) =>
            Helper.Concat(
                Helper.Concat(HashedAppKey(appId, prefix), LengthDelimitedId(id1)),
                (ByteString)id2.ToByteArray());
    }
}
