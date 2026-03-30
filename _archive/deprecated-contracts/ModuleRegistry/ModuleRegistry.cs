using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Phase-1 registry skeleton for shared capability module cataloging.
    /// Stores opaque schema/compatibility bytes now; richer validation can layer on later.
    /// </summary>
    [DisplayName("ModuleRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "0.1.0")]
    [ManifestExtra("Description", "Registry skeleton for shared modular capability contracts")]
    public class ModuleRegistry : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_MODULE = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_MODULE_VERSIONS = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ACTIVE_MODULE_HASH = new byte[] { 0x04 };

        public struct ModuleInfo
        {
            public string ModuleId;
            public string Version;
            public UInt160 ContractHash;
            public ByteString InitSchemaHash;
            public ByteString OperationSchemaHash;
            public string RiskProfile;
            public ByteString CompatibilityMetadata;
            public bool Active;
            public ulong UpdatedAt;
            public UInt160 UpdatedBy;
        }

        [DisplayName("ModuleUpserted")]
        public static event Action<string, string, UInt160, bool> OnModuleUpserted = delegate { };

        [DisplayName("ModuleStatusChanged")]
        public static event Action<string, string, bool> OnModuleStatusChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        private static StorageMap ModuleMap() => new StorageMap(Storage.CurrentContext, PREFIX_MODULE);
        private static StorageMap VersionMap() => new StorageMap(Storage.CurrentContext, PREFIX_MODULE_VERSIONS);
        private static StorageMap ActiveHashMap() => new StorageMap(Storage.CurrentContext, PREFIX_ACTIVE_MODULE_HASH);

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static string[] ReadStringList(StorageMap map, ByteString key)
        {
            ByteString? raw = map.Get(key);
            if (raw == null || raw.Length == 0)
            {
                return new string[0];
            }

            return (string[])StdLib.Deserialize(raw);
        }

        private static void WriteStringList(StorageMap map, ByteString key, string[] values)
        {
            if (values.Length == 0)
            {
                map.Delete(key);
                return;
            }

            map.Put(key, StdLib.Serialize(values));
        }

        private static string[] AppendUnique(string[] values, string value)
        {
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] == value) return values;
            }

            string[] next = new string[values.Length + 1];
            for (int i = 0; i < values.Length; i++)
            {
                next[i] = values[i];
            }

            next[values.Length] = value;
            return next;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 96, label + " too long");
        }

        private static ByteString ModuleKey(string moduleId, string version)
        {
            ValidateIdentifier(moduleId, "module id");
            ValidateIdentifier(version, "version");
            return (ByteString)((moduleId ?? "") + "@" + (version ?? ""));
        }

        private static ByteString ModuleVersionKey(string moduleId)
        {
            ValidateIdentifier(moduleId, "module id");
            return (ByteString)(moduleId ?? "");
        }

        private static ByteString ModuleHashKey(UInt160 contractHash)
        {
            ExecutionEngine.Assert(contractHash != UInt160.Zero && contractHash.IsValid, "invalid contract hash");
            return (ByteString)contractHash;
        }

        private static ByteString NormalizeBlob(ByteString value)
        {
            return value ?? (ByteString)"";
        }

        private static ModuleInfo EmptyModule()
        {
            return new ModuleInfo
            {
                ModuleId = "",
                Version = "",
                ContractHash = UInt160.Zero,
                InitSchemaHash = (ByteString)"",
                OperationSchemaHash = (ByteString)"",
                RiskProfile = "",
                CompatibilityMetadata = (ByteString)"",
                Active = false,
                UpdatedAt = 0,
                UpdatedBy = UInt160.Zero
            };
        }

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static ModuleInfo GetModule(string moduleId, string version)
        {
            ByteString? raw = ModuleMap().Get(ModuleKey(moduleId, version));
            return raw == null ? EmptyModule() : (ModuleInfo)StdLib.Deserialize(raw);
        }

        [Safe]
        public static string[] GetModuleVersions(string moduleId)
        {
            return ReadStringList(VersionMap(), ModuleVersionKey(moduleId));
        }

        [Safe]
        public static UInt160 ResolveModuleHash(string moduleId, string version)
        {
            ModuleInfo info = GetModule(moduleId, version);
            return info.ContractHash;
        }

        [Safe]
        public static bool IsModuleActive(UInt160 contractHash)
        {
            if (contractHash == UInt160.Zero || !contractHash.IsValid)
            {
                return false;
            }

            ByteString? raw = ActiveHashMap().Get(ModuleHashKey(contractHash));
            return raw != null && raw.Length > 0 && (BigInteger)raw == 1;
        }

        public static void UpsertModule(
            string moduleId,
            string version,
            UInt160 contractHash,
            ByteString initSchemaHash,
            ByteString operationSchemaHash,
            string riskProfile,
            ByteString compatibilityMetadata,
            bool active)
        {
            ValidateAdmin();
            ValidateIdentifier(moduleId, "module id");
            ValidateIdentifier(version, "version");
            ExecutionEngine.Assert(contractHash != UInt160.Zero && contractHash.IsValid, "invalid contract hash");

            ModuleInfo existing = GetModule(moduleId, version);
            if (existing.ModuleId.Length > 0 && existing.Active)
            {
                ActiveHashMap().Delete(ModuleHashKey(existing.ContractHash));
            }

            string normalizedRiskProfile = riskProfile ?? "";
            ExecutionEngine.Assert(normalizedRiskProfile.Length <= 64, "risk profile too long");

            ModuleInfo info = new ModuleInfo
            {
                ModuleId = moduleId,
                Version = version,
                ContractHash = contractHash,
                InitSchemaHash = NormalizeBlob(initSchemaHash),
                OperationSchemaHash = NormalizeBlob(operationSchemaHash),
                RiskProfile = normalizedRiskProfile,
                CompatibilityMetadata = NormalizeBlob(compatibilityMetadata),
                Active = active,
                UpdatedAt = Runtime.Time,
                UpdatedBy = Runtime.Transaction.Sender
            };

            ModuleMap().Put(ModuleKey(moduleId, version), StdLib.Serialize(info));

            if (active)
            {
                ActiveHashMap().Put(ModuleHashKey(contractHash), 1);
            }

            string[] versions = ReadStringList(VersionMap(), ModuleVersionKey(moduleId));
            WriteStringList(VersionMap(), ModuleVersionKey(moduleId), AppendUnique(versions, version));

            OnModuleUpserted(moduleId, version, contractHash, active);
        }

        public static void SetModuleActive(string moduleId, string version, bool active)
        {
            ValidateAdmin();

            ModuleInfo info = GetModule(moduleId, version);
            ExecutionEngine.Assert(info.ModuleId.Length > 0, "module not found");

            if (info.Active == active) return;

            if (info.Active)
            {
                ActiveHashMap().Delete(ModuleHashKey(info.ContractHash));
            }

            info.Active = active;
            info.UpdatedAt = Runtime.Time;
            info.UpdatedBy = Runtime.Transaction.Sender;
            ModuleMap().Put(ModuleKey(moduleId, version), StdLib.Serialize(info));

            if (active)
            {
                ActiveHashMap().Put(ModuleHashKey(info.ContractHash), 1);
            }

            OnModuleStatusChanged(moduleId, version, active);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");

            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }
    }
}
