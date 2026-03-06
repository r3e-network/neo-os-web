using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;
using ServiceContract = Neo.SmartContract.Framework.Services.Contract;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Enhanced MiniApp Factory with template schema support.
    ///
    /// Features:
    /// - Template versioning
    /// - Config schema and UI schema storage
    /// - Category/type indexes
    /// - Deployment tracking
    /// </summary>
    [DisplayName("MiniAppFactory")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Enhanced template-based miniapp contract factory with schema support")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region Storage Prefixes
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_TEMPLATE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TEMPLATE_TYPE = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_TEMPLATE_CATEGORY = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_DEPLOYMENT = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_TEMPLATE_LIST = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_CATEGORY_INDEX = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_DEPLOYMENT_BY_HASH = new byte[] { 0x09 };
        #endregion

        #region Data Structures
        public struct TemplateInfo
        {
            public string TemplateId;
            public string TemplateType;
            public string Category;
            public ByteString NefFile;
            public string Manifest;
            public ByteString NefHash;
            public ByteString ManifestHash;
            public string Description;
            public string Version;
            public ByteString ConfigSchema;
            public ByteString UiSchema;
            public bool Active;
            public ulong UpdatedAt;
            public UInt160 UpdatedBy;
            public ulong DeployCount;
        }

        public struct DeploymentRecord
        {
            public string TemplateId;
            public string TemplateType;
            public UInt160 ContractHash;
            public UInt160 Deployer;
            public ByteString InitParams;
            public string AppId;
            public ulong DeployedAt;
        }

        public struct TemplateTypeInfo
        {
            public string Type;
            public string DisplayName;
            public string Description;
            public string Icon;
        }

        public struct ConfigSchemaField
        {
            public string Name;
            public string Type;
            public string Label;
            public bool Required;
            public string DefaultValue;
            public string Placeholder;
            public ByteString Options;
            public BigInteger Min;
            public BigInteger Max;
        }
        #endregion

        #region Events
        [DisplayName("TemplateUpserted")]
        public static event Action<string, string, ByteString, ByteString, bool> OnTemplateUpserted;

        [DisplayName("TemplateDeployed")]
        public static event Action<string, string, UInt160, UInt160> OnTemplateDeployed;

        [DisplayName("AppRegistryChanged")]
        public static event Action<UInt160, UInt160> OnAppRegistryChanged;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            InitializeDefaultTemplateCategories();
        }

        private static void InitializeDefaultTemplateCategories()
        {
            StorageMap categoryLabelMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_CATEGORY);

            categoryLabelMap.Put((ByteString)"gaming", "Games & Entertainment");
            categoryLabelMap.Put((ByteString)"defi", "DeFi & Finance");
            categoryLabelMap.Put((ByteString)"social", "Social & Community");
            categoryLabelMap.Put((ByteString)"nft", "NFT & Collectibles");
            categoryLabelMap.Put((ByteString)"governance", "Governance & Voting");
            categoryLabelMap.Put((ByteString)"utility", "Utility & Tools");
            categoryLabelMap.Put((ByteString)"data", "Data & Analytics");
        }
        #endregion

        #region Internal Storage Helpers
        private static StorageMap TemplateMap() => new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE);
        private static StorageMap TemplateTypeIndexMap() => new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_TYPE);
        private static StorageMap TemplateListMap() => new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_LIST);
        private static StorageMap CategoryIndexMap() => new StorageMap(Storage.CurrentContext, PREFIX_CATEGORY_INDEX);
        private static StorageMap DeploymentMap() => new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT);
        private static StorageMap DeploymentByHashMap() => new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT_BY_HASH);

        private static ByteString IndexKey(string value)
        {
            return (ByteString)("idx:" + (value ?? ""));
        }

        private static ByteString AllTemplatesKey()
        {
            return (ByteString)"all";
        }

        private static ByteString DeploymentKey(string templateId, UInt160 contractHash)
        {
            return Helper.Concat((ByteString)templateId, (ByteString)contractHash);
        }

        private static string[] ReadStringList(StorageMap map, ByteString key)
        {
            ByteString raw = map.Get(key);
            if (raw == null || raw.Length == 0)
            {
                return new string[0];
            }
            return (string[])StdLib.Deserialize(raw);
        }

        private static void WriteStringList(StorageMap map, ByteString key, string[] values)
        {
            if (values == null || values.Length == 0)
            {
                map.Delete(key);
                return;
            }
            map.Put(key, StdLib.Serialize(values));
        }

        private static bool ContainsString(string[] values, string value)
        {
            if (values == null || value == null) return false;
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] == value) return true;
            }
            return false;
        }

        private static string[] AppendUnique(string[] values, string value)
        {
            if (value == null || value.Length == 0)
            {
                return values ?? new string[0];
            }

            string[] current = values ?? new string[0];
            if (ContainsString(current, value))
            {
                return current;
            }

            string[] next = new string[current.Length + 1];
            for (int i = 0; i < current.Length; i++)
            {
                next[i] = current[i];
            }
            next[current.Length] = value;
            return next;
        }

        private static string[] RemoveValue(string[] values, string value)
        {
            if (values == null || values.Length == 0 || value == null || value.Length == 0)
            {
                return values ?? new string[0];
            }

            int keptCount = 0;
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] != value) keptCount++;
            }

            if (keptCount == values.Length)
            {
                return values;
            }

            string[] next = new string[keptCount];
            int cursor = 0;
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] == value) continue;
                next[cursor] = values[i];
                cursor++;
            }
            return next;
        }

        private static string[] GetAllTemplateIdsInternal()
        {
            return ReadStringList(TemplateListMap(), AllTemplatesKey());
        }

        private static void AddTemplateIdToAllList(string templateId)
        {
            string[] ids = GetAllTemplateIdsInternal();
            string[] next = AppendUnique(ids, templateId);
            WriteStringList(TemplateListMap(), AllTemplatesKey(), next);
        }

        private static void RemoveTemplateIdFromAllList(string templateId)
        {
            string[] ids = GetAllTemplateIdsInternal();
            string[] next = RemoveValue(ids, templateId);
            WriteStringList(TemplateListMap(), AllTemplatesKey(), next);
        }

        private static string[] GetIndexedTemplateIds(StorageMap map, string indexValue, bool includeLegacySingle)
        {
            if (indexValue == null || indexValue.Length == 0)
            {
                return new string[0];
            }

            ByteString indexRaw = map.Get(IndexKey(indexValue));
            if (indexRaw != null && indexRaw.Length > 0)
            {
                return (string[])StdLib.Deserialize(indexRaw);
            }

            if (!includeLegacySingle)
            {
                return new string[0];
            }

            ByteString legacy = map.Get((ByteString)indexValue);
            if (legacy == null || legacy.Length == 0)
            {
                return new string[0];
            }

            return new string[] { (string)legacy };
        }

        private static void AddToIndex(StorageMap map, string indexValue, string templateId, bool writeLegacySingle)
        {
            if (indexValue == null || indexValue.Length == 0) return;

            string[] current = GetIndexedTemplateIds(map, indexValue, false);
            string[] next = AppendUnique(current, templateId);
            WriteStringList(map, IndexKey(indexValue), next);

            if (writeLegacySingle)
            {
                map.Put((ByteString)indexValue, templateId);
            }
        }

        private static void RemoveFromIndex(StorageMap map, string indexValue, string templateId, bool writeLegacySingle)
        {
            if (indexValue == null || indexValue.Length == 0) return;

            string[] current = GetIndexedTemplateIds(map, indexValue, false);
            string[] next = RemoveValue(current, templateId);
            WriteStringList(map, IndexKey(indexValue), next);

            if (writeLegacySingle)
            {
                if (next.Length > 0)
                {
                    map.Put((ByteString)indexValue, next[0]);
                }
                else
                {
                    map.Delete((ByteString)indexValue);
                }
            }
        }

        private static void SaveDeploymentRecord(string templateId, UInt160 contractHash, DeploymentRecord record)
        {
            ByteString payload = StdLib.Serialize(record);
            DeploymentMap().Put(DeploymentKey(templateId, contractHash), payload);
            DeploymentByHashMap().Put((ByteString)contractHash, payload);
        }

        private static void UpdateDeploymentAppId(string templateId, UInt160 contractHash, string appId)
        {
            ByteString raw = DeploymentByHashMap().Get((ByteString)contractHash);
            if (raw == null) return;

            DeploymentRecord record = (DeploymentRecord)StdLib.Deserialize(raw);
            record.AppId = appId ?? "";
            SaveDeploymentRecord(templateId, contractHash, record);
        }
        #endregion

        #region Admin Methods
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        public static UInt160 AppRegistry() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_APP_REGISTRY);

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appRegistry != null && appRegistry.IsValid, "invalid app registry");
            UInt160 oldRegistry = AppRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, appRegistry);
            OnAppRegistryChanged(oldRegistry, appRegistry);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid admin");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }
        #endregion

        #region Template Management
        public static TemplateInfo GetTemplate(string templateId)
        {
            ByteString raw = TemplateMap().Get((ByteString)templateId);
            if (raw == null) return new TemplateInfo();
            return (TemplateInfo)StdLib.Deserialize(raw);
        }

        public static void UpsertTemplate(
            string templateId,
            string templateType,
            string category,
            ByteString nefFile,
            string manifest,
            string description,
            string version,
            ByteString configSchema,
            ByteString uiSchema,
            bool active)
        {
            ValidateAdmin();

            ExecutionEngine.Assert(templateId != null && templateId.Length > 0, "template id required");
            ExecutionEngine.Assert(templateType != null && templateType.Length > 0, "template type required");
            ExecutionEngine.Assert(nefFile != null && nefFile.Length > 0, "nef required");
            ExecutionEngine.Assert(manifest != null && manifest.Length > 0, "manifest required");

            TemplateInfo existing = GetTemplate(templateId);
            bool isUpdate = existing.TemplateId != null && existing.TemplateId.Length > 0;

            UInt160 operatorAddress = Runtime.Transaction.Sender;
            ByteString nefHash = CryptoLib.Sha256(nefFile);
            ByteString manifestHash = CryptoLib.Sha256((ByteString)manifest);
            string normalizedCategory = category != null && category.Length > 0 ? category : "utility";

            TemplateInfo info = new TemplateInfo
            {
                TemplateId = templateId,
                TemplateType = templateType,
                Category = normalizedCategory,
                NefFile = nefFile,
                Manifest = manifest,
                NefHash = nefHash,
                ManifestHash = manifestHash,
                Description = description ?? "",
                Version = version ?? "1.0.0",
                ConfigSchema = configSchema ?? (ByteString)"",
                UiSchema = uiSchema ?? (ByteString)"",
                Active = active,
                UpdatedAt = Runtime.Time,
                UpdatedBy = operatorAddress,
                DeployCount = existing.DeployCount
            };

            TemplateMap().Put((ByteString)templateId, StdLib.Serialize(info));
            AddTemplateIdToAllList(templateId);

            if (isUpdate)
            {
                if (existing.TemplateType != null && existing.TemplateType.Length > 0 && existing.TemplateType != templateType)
                {
                    RemoveFromIndex(TemplateTypeIndexMap(), existing.TemplateType, templateId, true);
                }

                if (existing.Category != null && existing.Category.Length > 0 && existing.Category != normalizedCategory)
                {
                    RemoveFromIndex(CategoryIndexMap(), existing.Category, templateId, false);
                }
            }

            AddToIndex(TemplateTypeIndexMap(), templateType, templateId, true);
            AddToIndex(CategoryIndexMap(), normalizedCategory, templateId, false);

            OnTemplateUpserted(templateId, templateType, nefHash, manifestHash, active);
        }

        public static void SetTemplateStatus(string templateId, bool active)
        {
            ValidateAdmin();
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null, "template not found");

            info.Active = active;
            info.UpdatedAt = Runtime.Time;
            info.UpdatedBy = Runtime.Transaction.Sender;
            TemplateMap().Put((ByteString)templateId, StdLib.Serialize(info));
        }

        public static void DeleteTemplate(string templateId)
        {
            ValidateAdmin();
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null && info.TemplateId.Length > 0, "template not found");

            TemplateMap().Delete((ByteString)templateId);
            RemoveTemplateIdFromAllList(templateId);
            RemoveFromIndex(TemplateTypeIndexMap(), info.TemplateType, templateId, true);
            RemoveFromIndex(CategoryIndexMap(), info.Category, templateId, false);
        }

        public static string[] GetTemplatesByType(string templateType)
        {
            return GetIndexedTemplateIds(TemplateTypeIndexMap(), templateType, true);
        }

        public static string[] GetTemplatesByCategory(string category)
        {
            string[] indexed = GetIndexedTemplateIds(CategoryIndexMap(), category, false);
            if (indexed.Length > 0)
            {
                return indexed;
            }

            string[] templateIds = GetAllTemplateIdsInternal();
            string[] matching = new string[templateIds.Length];
            int cursor = 0;

            for (int i = 0; i < templateIds.Length; i++)
            {
                TemplateInfo info = GetTemplate(templateIds[i]);
                if (info.TemplateId == null || info.TemplateId.Length == 0) continue;
                if (info.Category != category) continue;
                matching[cursor] = info.TemplateId;
                cursor++;
            }

            if (cursor == matching.Length)
            {
                return matching;
            }

            string[] compact = new string[cursor];
            for (int i = 0; i < cursor; i++)
            {
                compact[i] = matching[i];
            }
            return compact;
        }

        public static string[] GetAllTemplateIds()
        {
            return GetAllTemplateIdsInternal();
        }

        public static string[] GetAllCategories()
        {
            return new string[] { "gaming", "defi", "social", "nft", "governance", "utility", "data" };
        }
        #endregion

        #region Deployment
        public static UInt160 DeployFromTemplate(string templateId, ByteString initParams)
        {
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null, "template not found");
            ExecutionEngine.Assert(info.Active, "template disabled");

            ByteString initPayload = initParams ?? (ByteString)"";
            var deployedContract = ContractManagement.Deploy(info.NefFile, info.Manifest, initPayload);
            UInt160 contractHash = deployedContract.Hash;

            info.DeployCount++;
            TemplateMap().Put((ByteString)templateId, StdLib.Serialize(info));

            DeploymentRecord record = new DeploymentRecord
            {
                TemplateId = templateId,
                TemplateType = info.TemplateType,
                ContractHash = contractHash,
                Deployer = Runtime.Transaction.Sender,
                InitParams = initPayload,
                AppId = "",
                DeployedAt = Runtime.Time
            };
            SaveDeploymentRecord(templateId, contractHash, record);

            OnTemplateDeployed(templateId, info.TemplateType, Runtime.Transaction.Sender, contractHash);
            return contractHash;
        }

        public static UInt160 DeployAndRegister(
            string templateId,
            ByteString initParams,
            string appId,
            ByteString manifestHash,
            string entryUrl,
            ByteString developerPubKey,
            string name,
            string description,
            string icon,
            string banner,
            string category)
        {
            UInt160 contractHash = DeployFromTemplate(templateId, initParams);

            UInt160 appRegistry = AppRegistry();
            if (appRegistry != null && appRegistry.IsValid)
            {
                ServiceContract.Call(
                    appRegistry,
                    "registerApp",
                    CallFlags.All,
                    new object[]
                    {
                        appId,
                        manifestHash,
                        entryUrl,
                        developerPubKey,
                        (ByteString)contractHash,
                        name,
                        description,
                        icon,
                        banner,
                        category,
                    });
            }

            UpdateDeploymentAppId(templateId, contractHash, appId);
            return contractHash;
        }

        public static DeploymentRecord GetDeployment(UInt160 contractHash)
        {
            ByteString raw = DeploymentByHashMap().Get((ByteString)contractHash);
            if (raw == null) return new DeploymentRecord();
            return (DeploymentRecord)StdLib.Deserialize(raw);
        }

        public static BigInteger GetDeploymentCount(string templateId)
        {
            TemplateInfo info = GetTemplate(templateId);
            return info.DeployCount;
        }
        #endregion

        #region Schema Methods
        public static ByteString GetConfigSchema(string templateId)
        {
            TemplateInfo info = GetTemplate(templateId);
            return info.ConfigSchema;
        }

        public static ByteString GetUiSchema(string templateId)
        {
            TemplateInfo info = GetTemplate(templateId);
            return info.UiSchema;
        }

        public static bool ValidateConfig(string templateId, ByteString config)
        {
            TemplateInfo info = GetTemplate(templateId);
            if (info.ConfigSchema == null || info.ConfigSchema.Length == 0)
                return true;

            return true;
        }
        #endregion

        #region Upgrade
        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }
        #endregion
    }
}
