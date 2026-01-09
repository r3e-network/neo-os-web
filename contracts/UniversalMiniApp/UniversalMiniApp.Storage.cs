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
            ExecutionEngine.Assert(key != null && key.Length > 0, "key required");
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");

            ByteString storageKey = BuildStorageKey(appId, key);
            AppDataMap().Put(storageKey, value);
            OnValueSet(appId, key);
        }

        /// <summary>
        /// Get a value from app-specific storage.
        /// </summary>
        [Safe]
        public static ByteString GetValue(string appId, string key)
        {
            ValidateAppId(appId);
            ExecutionEngine.Assert(key != null && key.Length > 0, "key required");

            ByteString storageKey = BuildStorageKey(appId, key);
            return AppDataMap().Get(storageKey);
        }

        #endregion
    }
}
