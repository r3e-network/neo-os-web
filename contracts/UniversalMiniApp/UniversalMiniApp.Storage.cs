using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class UniversalMiniApp
    {
        #region Storage Module

        private static StorageMap AppDataMap() =>
            new StorageMap(Storage.CurrentContext, PREFIX_APP_DATA);

        private static void ValidateStorageKey(string key)
        {
            ExecutionEngine.Assert(key != null && key.Length > 0, "key required");
            ExecutionEngine.Assert(key.IndexOf(":") < 0, "key invalid");
        }

        private static ByteString BuildStorageKey(string appId, string key)
        {
            return Helper.Concat((ByteString)appId, (ByteString)(":" + key));
        }

        /// <summary>
        /// Set a value in app-specific storage.
        /// Only callable by Gateway on behalf of app owner.
        /// </summary>
        public static void SetValue(string appId, string key, ByteString value)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ValidateStorageKey(key);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");

            ByteString storageKey = BuildStorageKey(appId, key);
            AppDataMap().Put(storageKey, value);
            OnValueSet(appId, key);
        }

        /// <summary>
        /// Delete a value from app-specific storage.
        /// Only callable by Gateway on behalf of app owner.
        /// </summary>
        public static void DeleteValue(string appId, string key)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ValidateStorageKey(key);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");

            ByteString storageKey = BuildStorageKey(appId, key);
            AppDataMap().Delete(storageKey);
            OnValueDeleted(appId, key);
        }

        /// <summary>
        /// Get a value from app-specific storage.
        /// Returns null if app is not registered or key doesn't exist.
        /// </summary>
        [Safe]
        public static ByteString GetValue(string appId, string key)
        {
            ValidateAppId(appId);
            ValidateStorageKey(key);

            // Return null for unregistered apps (security: prevent data leakage)
            if (!IsAppRegistered(appId))
            {
                return null;
            }

            ByteString storageKey = BuildStorageKey(appId, key);
            return AppDataMap().Get(storageKey);
        }

        #endregion
    }
}
