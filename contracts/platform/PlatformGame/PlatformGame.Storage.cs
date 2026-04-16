using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        // ---------------------------------------------------------------
        //  Namespaced storage helpers
        //
        //  Every piece of app-specific data is prefixed with the appId so
        //  multiple registered games share a single contract without
        //  colliding.  The pattern is:
        //
        //      appId + prefix            (counters, scalars)
        //      appId + prefix + id       (per-round / per-bet records)
        //      appId + prefix + addr     (per-player data)
        //
        //  All helpers here are thin wrappers that keep the rest of the
        //  codebase free of manual key-building boilerplate.
        // ---------------------------------------------------------------

        #region Key Builders

        /// <summary>
        /// Build a namespaced storage key: appId + prefix.
        /// Used for singleton values per app (e.g. current round id).
        /// </summary>
        private static byte[] AppKey(string appId, byte[] prefix)
        {
            return (byte[])Helper.Concat((ByteString)appId, (ByteString)prefix);
        }

        /// <summary>
        /// Build a namespaced storage key: appId + prefix + BigInteger id.
        /// Used for indexed records (rounds, bets, machines, plays).
        /// </summary>
        private static byte[] AppKey(string appId, byte[] prefix, BigInteger id)
        {
            return (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix),
                (ByteString)id.ToByteArray());
        }

        /// <summary>
        /// Build a namespaced storage key: appId + prefix + UInt160 address.
        /// Used for per-player data (keys owned, stats, credits).
        /// </summary>
        private static byte[] AppKey(string appId, byte[] prefix, UInt160 addr)
        {
            return (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix),
                (ByteString)(byte[])addr);
        }

        #endregion

        #region Convenience Read / Write Wrappers

        /// <summary>Store a BigInteger value under an app-namespaced key.</summary>
        private static void AppPut(string appId, byte[] prefix, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, prefix), value);
        }

        /// <summary>Store a BigInteger value under an app-namespaced key with id suffix.</summary>
        private static void AppPut(string appId, byte[] prefix, BigInteger id, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, prefix, id), value);
        }

        /// <summary>Store bytes under an app-namespaced key.</summary>
        private static void AppPut(string appId, byte[] prefix, ByteString value)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, prefix), value);
        }

        /// <summary>Store bytes under an app-namespaced key with id suffix.</summary>
        private static void AppPut(string appId, byte[] prefix, BigInteger id, ByteString value)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, prefix, id), value);
        }

        /// <summary>Read a BigInteger from an app-namespaced key.</summary>
        private static BigInteger AppGetInt(string appId, byte[] prefix)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, prefix));
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>Read a BigInteger from an app-namespaced key with id suffix.</summary>
        private static BigInteger AppGetInt(string appId, byte[] prefix, BigInteger id)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, prefix, id));
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>Read a BigInteger from an app-namespaced key with address suffix.</summary>
        private static BigInteger AppGetInt(string appId, byte[] prefix, UInt160 addr)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, prefix, addr));
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>Read raw bytes from an app-namespaced key.</summary>
        private static ByteString AppGetBytes(string appId, byte[] prefix)
        {
            return Storage.Get(Storage.CurrentContext, AppKey(appId, prefix));
        }

        /// <summary>Read raw bytes from an app-namespaced key with id suffix.</summary>
        private static ByteString AppGetBytes(string appId, byte[] prefix, BigInteger id)
        {
            return Storage.Get(Storage.CurrentContext, AppKey(appId, prefix, id));
        }

        /// <summary>Read raw bytes from an app-namespaced key with address suffix.</summary>
        private static ByteString AppGetBytes(string appId, byte[] prefix, UInt160 addr)
        {
            return Storage.Get(Storage.CurrentContext, AppKey(appId, prefix, addr));
        }

        /// <summary>Delete an app-namespaced key.</summary>
        private static void AppDelete(string appId, byte[] prefix)
        {
            Storage.Delete(Storage.CurrentContext, AppKey(appId, prefix));
        }

        /// <summary>Delete an app-namespaced key with id suffix.</summary>
        private static void AppDelete(string appId, byte[] prefix, BigInteger id)
        {
            Storage.Delete(Storage.CurrentContext, AppKey(appId, prefix, id));
        }

        #endregion

        #region Composite Key Helpers

        /// <summary>
        /// Build a composite key: appId + prefix + addr + id.
        /// Useful for player-per-round data (e.g. keys owned in a round).
        /// </summary>
        private static byte[] AppKeyAddrId(string appId, byte[] prefix, UInt160 addr, BigInteger id)
        {
            return (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix, addr),
                (ByteString)id.ToByteArray());
        }

        /// <summary>
        /// Build a composite key: appId + prefix + id1 + id2.
        /// Useful for nested indexes (machine items, token lists).
        /// </summary>
        private static byte[] AppKeyIdId(string appId, byte[] prefix, BigInteger id1, BigInteger id2)
        {
            return (byte[])Helper.Concat(
                (ByteString)AppKey(appId, prefix, id1),
                (ByteString)id2.ToByteArray());
        }

        #endregion
    }
}
