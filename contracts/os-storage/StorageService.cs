using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.OS
{
    // Event delegates
    public delegate void DataSetHandler(string appId, string key);
    public delegate void DataDeletedHandler(string appId, string key);
    public delegate void AccessGrantedHandler(string ownerAppId, string readerAppId, string keyPrefix);
    public delegate void AccessRevokedHandler(string ownerAppId, string readerAppId, string keyPrefix);
    public delegate void StorageAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    [DisplayName("StorageService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS StorageService — on-chain KV storage scoped by appId")]
    [ContractPermission("*", "*")]
    public class StorageService : SmartContract
    {
        // Storage prefixes
        private static readonly byte[] PREFIX_ADMIN       = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_DATA        = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ACCESS      = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_KEY_COUNT   = new byte[] { 0x30 };

        // Limits
        private const int MAX_KEY_LENGTH = 128;
        private const int MAX_VALUE_SIZE = 4096;

        // Events
        [DisplayName("DataSet")]
        public static event DataSetHandler OnDataSet = delegate { };

        [DisplayName("DataDeleted")]
        public static event DataDeletedHandler OnDataDeleted = delegate { };

        [DisplayName("AccessGranted")]
        public static event AccessGrantedHandler OnAccessGranted = delegate { };

        [DisplayName("AccessRevoked")]
        public static event AccessRevokedHandler OnAccessRevoked = delegate { };

        [DisplayName("AdminChanged")]
        public static event StorageAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ──────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin ──────────────────────────────────────────────────

        [Safe]
        public static UInt160 GetAdmin()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        // ── AppRegistry reference ──────────────────────────────────

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appRegistry != UInt160.Zero && appRegistry.IsValid, "invalid address");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, (ByteString)appRegistry);
        }

        [Safe]
        private static UInt160 GetAppRegistry()
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, PREFIX_APP_REGISTRY);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        // ── Authorization ──────────────────────────────────────────

        private static void ValidateAppCaller(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");

            // Admin can always write on behalf of any app
            UInt160 admin = GetAdmin();
            if (admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin))
            {
                return;
            }

            // Accept calls from other contracts via CallingScriptHash
            UInt160 caller = Runtime.CallingScriptHash;
            if (caller != null && caller.IsValid && caller != Runtime.ExecutingScriptHash)
            {
                // In future: validate against AppRegistry that caller is the app's contract
                return;
            }

            // Fallback: require admin witness (direct invocations must be admin)
            ExecutionEngine.Assert(false, "unauthorized: no valid app caller");
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            if (value == 0)
                Storage.Delete(Storage.CurrentContext, key);
            else
                Storage.Put(Storage.CurrentContext, key, value);
        }

        // ── Storage key construction ───────────────────────────────

        private static ByteString DataKey(string appId, string key)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_DATA, (ByteString)appId),
                Helper.Concat((ByteString)":", (ByteString)key)
            );
        }

        private static ByteString DataPrefix(string appId)
        {
            return Helper.Concat((ByteString)PREFIX_DATA, (ByteString)appId);
        }

        private static ByteString AccessKey(string ownerAppId, string readerAppId, string keyPrefix)
        {
            return Helper.Concat(
                Helper.Concat(
                    Helper.Concat((ByteString)PREFIX_ACCESS, (ByteString)ownerAppId),
                    Helper.Concat((ByteString)":", (ByteString)readerAppId)
                ),
                Helper.Concat((ByteString)":", (ByteString)keyPrefix)
            );
        }

        private static ByteString KeyCountKey(string appId)
        {
            return Helper.Concat((ByteString)PREFIX_KEY_COUNT, (ByteString)appId);
        }

        // ── Key count tracking ─────────────────────────────────────

        private static BigInteger GetKeyCount(string appId)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, KeyCountKey(appId));
            return value == null ? 0 : (BigInteger)value;
        }

        private static void IncrementKeyCount(string appId)
        {
            BigInteger count = GetKeyCount(appId);
            Storage.Put(Storage.CurrentContext, KeyCountKey(appId), count + 1);
        }

        private static void DecrementKeyCount(string appId)
        {
            BigInteger count = GetKeyCount(appId);
            if (count > 0)
            {
                Storage.Put(Storage.CurrentContext, KeyCountKey(appId), count - 1);
            }
        }

        // ── Validation helpers ─────────────────────────────────────

        private static void ValidateKey(string key)
        {
            ExecutionEngine.Assert(key != null && key.Length > 0, "key required");
            ExecutionEngine.Assert(key!.Length <= MAX_KEY_LENGTH, "key too long");
        }

        private static void ValidateValue(ByteString value)
        {
            ExecutionEngine.Assert(value != null, "value required");
            ExecutionEngine.Assert(value!.Length <= MAX_VALUE_SIZE, "value too large");
        }

        // ── CRUD operations ────────────────────────────────────────

        public static void Set(string appId, string key, ByteString value)
        {
            ValidateAppCaller(appId);
            ValidateKey(key);
            ValidateValue(value);

            ByteString storageKey = DataKey(appId, key);

            // Track new keys for count
            ByteString? existing = Storage.Get(Storage.CurrentContext, storageKey);
            if (existing == null)
            {
                IncrementKeyCount(appId);
            }

            Storage.Put(Storage.CurrentContext, storageKey, value);
            OnDataSet(appId, key);
        }

        public static void BatchSet(string appId, string[] keys, ByteString[] values)
        {
            ValidateAppCaller(appId);
            ExecutionEngine.Assert(keys != null && values != null, "keys and values required");
            ExecutionEngine.Assert(keys!.Length == values!.Length, "keys/values length mismatch");
            ExecutionEngine.Assert(keys.Length > 0 && keys.Length <= 20, "batch size must be 1-20");

            for (int i = 0; i < keys.Length; i++)
            {
                ValidateKey(keys[i]);
                ValidateValue(values[i]);

                ByteString storageKey = DataKey(appId, keys[i]);

                ByteString? existing = Storage.Get(Storage.CurrentContext, storageKey);
                if (existing == null)
                {
                    IncrementKeyCount(appId);
                }

                Storage.Put(Storage.CurrentContext, storageKey, values[i]);
                OnDataSet(appId, keys[i]);
            }
        }

        public static void Delete(string appId, string key)
        {
            ValidateAppCaller(appId);
            ValidateKey(key);

            ByteString storageKey = DataKey(appId, key);
            ByteString? existing = Storage.Get(Storage.CurrentContext, storageKey);
            ExecutionEngine.Assert(existing != null, "key not found");

            Storage.Delete(Storage.CurrentContext, storageKey);
            DecrementKeyCount(appId);
            OnDataDeleted(appId, key);
        }

        [Safe]
        public static ByteString Get(string appId, string key)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ValidateKey(key);

            ByteString storageKey = DataKey(appId!, key);
            ByteString? value = Storage.Get(Storage.CurrentContext, storageKey);
            return value == null ? (ByteString)"" : value;
        }

        [Safe]
        public static string[] ListKeys(string appId, string prefix, int limit)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ExecutionEngine.Assert(limit >= 1 && limit <= 100, "limit must be 1-100");

            string normalizedPrefix = prefix ?? "";

            // Build the search prefix: PREFIX_DATA + appId + ":" + prefix
            ByteString searchPrefix = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_DATA, (ByteString)appId!),
                Helper.Concat((ByteString)":", (ByteString)normalizedPrefix)
            );

            // The full data prefix (PREFIX_DATA + appId + ":") to strip from results
            ByteString dataPrefix = Helper.Concat(
                Helper.Concat((ByteString)PREFIX_DATA, (ByteString)appId!),
                (ByteString)":"
            );
            int stripLength = dataPrefix.Length;

            Iterator iterator = Storage.Find(Storage.CurrentContext, searchPrefix, FindOptions.KeysOnly | FindOptions.RemovePrefix);
            string[] results = new string[limit];
            int count = 0;

            while (iterator.Next() && count < limit)
            {
                results[count] = (string)(ByteString)iterator.Value;
                count++;
            }

            // Return exact-sized array
            if (count == limit) return results;
            string[] trimmed = new string[count];
            for (int i = 0; i < count; i++)
            {
                trimmed[i] = results[i];
            }
            return trimmed;
        }

        // ── Cross-app access control ───────────────────────────────

        public static void GrantReadAccess(string ownerAppId, string readerAppId, string keyPrefix)
        {
            ValidateAppCaller(ownerAppId);
            ExecutionEngine.Assert(readerAppId != null && readerAppId.Length > 0, "readerAppId required");
            ExecutionEngine.Assert(keyPrefix != null, "keyPrefix required");

            string normalizedKeyPrefix = keyPrefix ?? "";
            ByteString accessKey = AccessKey(ownerAppId, readerAppId!, normalizedKeyPrefix);
            Storage.Put(Storage.CurrentContext, accessKey, 1);
            OnAccessGranted(ownerAppId, readerAppId!, normalizedKeyPrefix);
        }

        public static void RevokeAccess(string ownerAppId, string readerAppId, string keyPrefix)
        {
            ValidateAppCaller(ownerAppId);
            ExecutionEngine.Assert(readerAppId != null && readerAppId.Length > 0, "readerAppId required");
            ExecutionEngine.Assert(keyPrefix != null, "keyPrefix required");

            string normalizedKeyPrefix = keyPrefix ?? "";
            ByteString accessKey = AccessKey(ownerAppId, readerAppId!, normalizedKeyPrefix);
            Storage.Delete(Storage.CurrentContext, accessKey);
            OnAccessRevoked(ownerAppId, readerAppId!, normalizedKeyPrefix);
        }

        [Safe]
        public static ByteString ReadShared(string readerAppId, string ownerAppId, string key)
        {
            ExecutionEngine.Assert(readerAppId != null && readerAppId.Length > 0, "readerAppId required");
            ExecutionEngine.Assert(ownerAppId != null && ownerAppId.Length > 0, "ownerAppId required");
            ValidateKey(key);

            // Check if readerAppId has access to ownerAppId's key
            // We check progressively: exact key prefix, then broader prefixes
            // For simplicity, check if access was granted for "" (all keys) or the exact key
            ByteString allAccess = AccessKey(ownerAppId!, readerAppId!, "");
            ByteString keyAccess = AccessKey(ownerAppId!, readerAppId!, key);

            ByteString? hasAllAccess = Storage.Get(Storage.CurrentContext, allAccess);
            ByteString? hasKeyAccess = Storage.Get(Storage.CurrentContext, keyAccess);

            ExecutionEngine.Assert(hasAllAccess != null || hasKeyAccess != null, "access denied");

            ByteString storageKey = DataKey(ownerAppId!, key);
            ByteString? value = Storage.Get(Storage.CurrentContext, storageKey);
            return value == null ? (ByteString)"" : value;
        }
    }
}
