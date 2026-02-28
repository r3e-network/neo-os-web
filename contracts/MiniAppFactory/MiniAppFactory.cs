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
    public delegate void TemplateUpsertedHandler(
        string templateId,
        string templateType,
        ByteString nefHash,
        ByteString manifestHash,
        bool active);

    public delegate void TemplateStatusChangedHandler(string templateId, bool active);
    public delegate void TemplateDeletedHandler(string templateId);
    public delegate void TemplateDeployedHandler(string templateId, string templateType, UInt160 deployer, UInt160 contractHash);
    public delegate void AppRegistryChangedHandler(UInt160 oldRegistry, UInt160 newRegistry);

    [DisplayName("MiniAppFactory")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Template-based miniapp contract factory")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_TEMPLATE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TEMPLATE_TYPE = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_DEPLOYMENT_COUNT = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_TEMPLATE_LIST = new byte[] { 0x06 };

        public struct TemplateInfo
        {
            public string TemplateId;
            public string TemplateType;
            public ByteString NefFile;
            public string Manifest;
            public ByteString NefHash;
            public ByteString ManifestHash;
            public string Description;
            public bool Active;
            public ulong UpdatedAt;
            public UInt160 UpdatedBy;
            public string Version;
            public ByteString ConfigSchema;
        }

        [DisplayName("TemplateUpserted")]
        public static event TemplateUpsertedHandler OnTemplateUpserted;

        [DisplayName("TemplateStatusChanged")]
        public static event TemplateStatusChangedHandler OnTemplateStatusChanged;

        [DisplayName("TemplateDeleted")]
        public static event TemplateDeletedHandler OnTemplateDeleted;

        [DisplayName("TemplateDeployed")]
        public static event TemplateDeployedHandler OnTemplateDeployed;

        [DisplayName("AppRegistryChanged")]
        public static event AppRegistryChangedHandler OnAppRegistryChanged;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static UInt160 Admin()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
        }

        public static UInt160 AppRegistry()
        {
            return (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_APP_REGISTRY);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static StorageMap TemplateMap() => new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE);

        private static ByteString TemplateKey(string templateId)
        {
            ExecutionEngine.Assert(templateId != null && templateId.Length > 0, "template id required");
            ExecutionEngine.Assert(templateId.Length <= 64, "template id too long");
            return (ByteString)templateId;
        }

        public static TemplateInfo GetTemplate(string templateId)
        {
            ByteString raw = TemplateMap().Get(TemplateKey(templateId));
            if (raw == null)
            {
                return new TemplateInfo
                {
                    TemplateId = "",
                    TemplateType = "",
                    NefFile = (ByteString)"",
                    Manifest = "",
                    NefHash = (ByteString)"",
                    ManifestHash = (ByteString)"",
                    Description = "",
                    Active = false,
                    UpdatedAt = 0,
                    UpdatedBy = null
                };
            }
            return (TemplateInfo)StdLib.Deserialize(raw);
        }

        public static void UpsertTemplate(
            string templateId,
            string templateType,
            ByteString nefFile,
            string manifest,
            string description,
            bool active,
            string version,
            ByteString configSchema)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(templateType != null && templateType.Length > 0, "template type required");
            ExecutionEngine.Assert(templateType.Length <= 32, "template type too long");
            ExecutionEngine.Assert(nefFile != null && nefFile.Length > 0, "nef required");
            ExecutionEngine.Assert(manifest != null && manifest.Length > 0, "manifest required");
            ExecutionEngine.Assert(manifest.Length <= 65535, "manifest too long");
            ExecutionEngine.Assert((description ?? "").Length <= 512, "description too long");

            UInt160 operatorAddress = Runtime.Transaction.Sender;
            ByteString nefHash = CryptoLib.Sha256(nefFile);
            ByteString manifestHash = CryptoLib.Sha256((ByteString)manifest);

            TemplateInfo info = new TemplateInfo
            {
                TemplateId = templateId,
                TemplateType = templateType,
                NefFile = nefFile,
                Manifest = manifest,
                NefHash = nefHash,
                ManifestHash = manifestHash,
                Description = description ?? "",
                Active = active,
                UpdatedAt = Runtime.Time,
                UpdatedBy = operatorAddress,
                Version = version ?? "1.0.0",
                ConfigSchema = configSchema ?? (ByteString)""
            };

            TemplateMap().Put(TemplateKey(templateId), StdLib.Serialize(info));
            
            StorageMap typeMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_TYPE);
            typeMap.Put((ByteString)templateType, templateId);

            StorageMap listMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_LIST);
            ByteString existingListRaw = listMap.Get((ByteString)"all");
            string[] templateIds = existingListRaw != null
                ? (string[])StdLib.Deserialize(existingListRaw)
                : new string[0];
            bool existsInList = false;
            for (int i = 0; i < templateIds.Length; i++)
            {
                if (templateIds[i] == templateId)
                {
                    existsInList = true;
                    break;
                }
            }
            if (!existsInList)
            {
                string[] nextIds = new string[templateIds.Length + 1];
                for (int i = 0; i < templateIds.Length; i++)
                {
                    nextIds[i] = templateIds[i];
                }
                nextIds[templateIds.Length] = templateId;
                listMap.Put((ByteString)"all", StdLib.Serialize(nextIds));
            }
            
            OnTemplateUpserted(templateId, templateType, nefHash, manifestHash, active);
        }

        public static void SetTemplateStatus(string templateId, bool active)
        {
            ValidateAdmin();
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null && info.TemplateId.Length > 0, "template not found");

            info.Active = active;
            info.UpdatedAt = Runtime.Time;
            info.UpdatedBy = Runtime.Transaction.Sender;
            TemplateMap().Put(TemplateKey(templateId), StdLib.Serialize(info));

            OnTemplateStatusChanged(templateId, active);
        }

        public static void DeleteTemplate(string templateId)
        {
            ValidateAdmin();
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null && info.TemplateId.Length > 0, "template not found");
            TemplateMap().Delete(TemplateKey(templateId));

            StorageMap listMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_LIST);
            ByteString existingListRaw = listMap.Get((ByteString)"all");
            if (existingListRaw != null)
            {
                string[] templateIds = (string[])StdLib.Deserialize(existingListRaw);
                int keptCount = 0;
                for (int i = 0; i < templateIds.Length; i++)
                {
                    if (templateIds[i] != templateId) keptCount++;
                }

                string[] nextIds = new string[keptCount];
                int cursor = 0;
                for (int i = 0; i < templateIds.Length; i++)
                {
                    if (templateIds[i] == templateId) continue;
                    nextIds[cursor] = templateIds[i];
                    cursor++;
                }

                if (keptCount == 0)
                {
                    listMap.Delete((ByteString)"all");
                }
                else
                {
                    listMap.Put((ByteString)"all", StdLib.Serialize(nextIds));
                }
            }

            OnTemplateDeleted(templateId);
        }

        public static UInt160 DeployFromTemplate(string templateId, object initData)
        {
            TemplateInfo info = GetTemplate(templateId);
            ExecutionEngine.Assert(info.TemplateId != null && info.TemplateId.Length > 0, "template not found");
            ExecutionEngine.Assert(info.Active, "template disabled");

            var deployedContract = ContractManagement.Deploy(info.NefFile, info.Manifest, initData);
            UInt160 contractHash = deployedContract.Hash;
            OnTemplateDeployed(templateId, info.TemplateType, Runtime.Transaction.Sender, contractHash);
            return contractHash;
        }

        public static UInt160 DeployAndRegisterFromTemplate(
            string templateId,
            object initData,
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
            UInt160 appRegistry = AppRegistry();
            ExecutionEngine.Assert(appRegistry != null && appRegistry.IsValid, "app registry not set");

            UInt160 contractHash = DeployFromTemplate(templateId, initData);

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
                    name ?? "",
                    description ?? "",
                    icon ?? "",
                    banner ?? "",
                    category ?? ""
                });

            return contractHash;
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

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }

        public static string[] GetTemplatesByType(string templateType)
        {
            StorageMap typeMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_TYPE);
            ByteString data = typeMap.Get((ByteString)templateType);
            if (data == null) return new string[0];
            return new string[] { (string)data };
        }

        public static TemplateInfo[] GetAllTemplates()
        {
            StorageMap listMap = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_LIST);
            ByteString existingListRaw = listMap.Get((ByteString)"all");
            if (existingListRaw == null)
            {
                return new TemplateInfo[0];
            }

            string[] templateIds = (string[])StdLib.Deserialize(existingListRaw);
            TemplateInfo[] results = new TemplateInfo[templateIds.Length];
            int cursor = 0;
            for (int i = 0; i < templateIds.Length; i++)
            {
                TemplateInfo info = GetTemplate(templateIds[i]);
                if (info.TemplateId == null || info.TemplateId.Length == 0) continue;
                results[cursor] = info;
                cursor++;
            }

            if (cursor == results.Length)
            {
                return results;
            }

            TemplateInfo[] compact = new TemplateInfo[cursor];
            for (int i = 0; i < cursor; i++)
            {
                compact[i] = results[i];
            }
            return compact;
        }

        public static BigInteger GetDeploymentCount(string templateId)
        {
            StorageMap map = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT_COUNT);
            ByteString data = map.Get((ByteString)templateId);
            return data != null ? (BigInteger)data : 0;
        }

        public static ByteString GetConfigSchema(string templateId)
        {
            TemplateInfo info = GetTemplate(templateId);
            return info.ConfigSchema;
        }
    }
}
