using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        #region Storage Key Builders

        /// <summary>Build an app-scoped key: appId + prefix.</summary>
        private static ByteString AppKey(string appId, byte[] prefix) =>
            Helper.Concat((ByteString)appId, (ByteString)prefix);

        /// <summary>Build an app-scoped key: appId + prefix + BigInteger id.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)id.ToByteArray());

        /// <summary>Build an app-scoped key: appId + prefix + address.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, UInt160 addr) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: appId + prefix + BigInteger id + address.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id, UInt160 addr) =>
            Helper.Concat(AppKey(appId, prefix, id), (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: appId + prefix + id1 + id2.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id1, BigInteger id2) =>
            Helper.Concat(AppKey(appId, prefix, id1), (ByteString)id2.ToByteArray());

        #endregion

        #region Storage Helpers

        private static void Put(ByteString key, BigInteger value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void Put(ByteString key, ByteString value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static BigInteger GetBigInteger(ByteString key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        private static ByteString GetRaw(ByteString key) =>
            Storage.Get(Storage.CurrentContext, key);

        private static void Delete(ByteString key) =>
            Storage.Delete(Storage.CurrentContext, key);

        #endregion

        #region Address Read Helper

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        #endregion
    }
}
