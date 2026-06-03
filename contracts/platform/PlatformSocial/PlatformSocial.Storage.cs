using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformSocialContract
    {
        #region Storage Key Builders

        // Audit fix (M-3): the previous builders concatenated the variable-length appId directly
        // with the prefix and ids with NO delimiters, so distinct (appId, prefix, id...) tuples
        // could serialize to the same key — a cross-tenant collision letting one miniapp read or
        // overwrite another's red-envelope / vault / trust storage. We now (a) scope every key by
        // a FIXED 32-byte hash of the appId (so the appId/prefix boundary is unambiguous and no
        // appId can be a prefix of another's key), and (b) length-delimit each leading
        // variable-length BigInteger id so multi-id keys are unambiguous too. PlatformSocial is
        // not deployed, so no state migration is required.

        /// <summary>Fixed-length, collision-free app scope.</summary>
        private static ByteString AppScope(string appId) => CryptoLib.Sha256((ByteString)appId);

        /// <summary>Length-delimited encoding of a variable-length BigInteger id segment.</summary>
        private static ByteString IdSegment(BigInteger id)
        {
            byte[] raw = id.ToByteArray();
            ExecutionEngine.Assert(raw.Length <= 255, "id segment too large");
            return Helper.Concat((ByteString)new byte[] { (byte)raw.Length }, (ByteString)raw);
        }

        /// <summary>Build an app-scoped key: sha256(appId) + prefix.</summary>
        private static ByteString AppKey(string appId, byte[] prefix) =>
            Helper.Concat(AppScope(appId), (ByteString)prefix);

        /// <summary>Build an app-scoped key: sha256(appId) + prefix + BigInteger id (trailing, unambiguous).</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)id.ToByteArray());

        /// <summary>Build an app-scoped key: sha256(appId) + prefix + address (fixed 20 bytes).</summary>
        private static ByteString AppKey(string appId, byte[] prefix, UInt160 addr) =>
            Helper.Concat(AppKey(appId, prefix), (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: sha256(appId) + prefix + len-delimited id + address.</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id, UInt160 addr) =>
            Helper.Concat(Helper.Concat(AppKey(appId, prefix), IdSegment(id)), (ByteString)(byte[])addr);

        /// <summary>Build an app-scoped key: sha256(appId) + prefix + len-delimited id1 + id2 (trailing).</summary>
        private static ByteString AppKey(string appId, byte[] prefix, BigInteger id1, BigInteger id2) =>
            Helper.Concat(Helper.Concat(AppKey(appId, prefix), IdSegment(id1)), (ByteString)id2.ToByteArray());

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
