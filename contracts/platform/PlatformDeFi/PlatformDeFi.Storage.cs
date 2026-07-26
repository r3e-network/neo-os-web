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
            MiniAppStorageKeys.AppKeyValue(appId, prefix);

        /// <summary>Build an app-scoped key: appId + prefix + BigInteger id.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id) =>
            MiniAppStorageKeys.AppKeyValue(appId, prefix, id);

        /// <summary>Build an app-scoped key: appId + prefix + address.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, UInt160 addr) =>
            MiniAppStorageKeys.AppKeyValue(appId, prefix, addr);

        private static ByteString LegacyCreditKey(byte[] prefix, UInt160 addr) =>
            Helper.Concat((ByteString)prefix, (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: appId + prefix + BigInteger id + address.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id, UInt160 addr) =>
            Helper.Concat(MiniAppStorageKeys.AppKeyValue(appId, prefix, id), (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: appId + prefix + id1 + id2.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id1, BigInteger id2) =>
            Helper.Concat(MiniAppStorageKeys.AppKeyValue(appId, prefix, id1), (ByteString)id2.ToByteArray());

        #endregion

        #region Storage Helpers

        private static void Put(ByteString key, BigInteger value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void Put(ByteString key, ByteString value) =>
            Storage.Put(Storage.CurrentContext, key, value);

        private static void PutAddress(ByteString key, UInt160 value) =>
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

        private static UInt160 ReadAddress(ByteString key)
        {
            ByteString value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        #endregion
    }
}
