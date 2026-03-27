using System;
using System.ComponentModel;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Phase-1 registry skeleton for canonical module recipes.
    /// Module graphs and schemas stay opaque for now so factory/build tooling can evolve independently.
    /// </summary>
    [DisplayName("RecipeRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "0.1.0")]
    [ManifestExtra("Description", "Registry skeleton for modular miniapp recipe bundles")]
    public class RecipeRegistry : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_MODULE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_RECIPE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_RECIPE_VERSIONS = new byte[] { 0x11 };

        public struct RecipeInfo
        {
            public string RecipeId;
            public string Version;
            public ByteString ModuleRefs;
            public ByteString RequiredFields;
            public ByteString OperationSchema;
            public string AllowedRuntimeMode;
            public string RouterTemplateId;
            public ByteString CompatibilityMetadata;
            public bool Active;
            public ulong UpdatedAt;
            public UInt160 UpdatedBy;
        }

        [DisplayName("RecipeUpserted")]
        public static event Action<string, string, string, bool> OnRecipeUpserted = delegate { };

        [DisplayName("RecipeStatusChanged")]
        public static event Action<string, string, bool> OnRecipeStatusChanged = delegate { };

        [DisplayName("ModuleRegistryChanged")]
        public static event Action<UInt160, UInt160> OnModuleRegistryChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        private static StorageMap RecipeMap() => new StorageMap(Storage.CurrentContext, PREFIX_RECIPE);
        private static StorageMap VersionMap() => new StorageMap(Storage.CurrentContext, PREFIX_RECIPE_VERSIONS);

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

        private static ByteString RecipeKey(string recipeId, string version)
        {
            ValidateIdentifier(recipeId, "recipe id");
            ValidateIdentifier(version, "version");
            return (ByteString)((recipeId ?? "") + "@" + (version ?? ""));
        }

        private static ByteString RecipeVersionKey(string recipeId)
        {
            ValidateIdentifier(recipeId, "recipe id");
            return (ByteString)(recipeId ?? "");
        }

        private static ByteString NormalizeBlob(ByteString value)
        {
            return value ?? (ByteString)"";
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static RecipeInfo EmptyRecipe()
        {
            return new RecipeInfo
            {
                RecipeId = "",
                Version = "",
                ModuleRefs = (ByteString)"",
                RequiredFields = (ByteString)"",
                OperationSchema = (ByteString)"",
                AllowedRuntimeMode = "",
                RouterTemplateId = "",
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
        public static UInt160 ModuleRegistry()
        {
            return ReadAddress(PREFIX_MODULE_REGISTRY);
        }

        [Safe]
        public static RecipeInfo GetRecipe(string recipeId, string version)
        {
            ByteString? raw = RecipeMap().Get(RecipeKey(recipeId, version));
            return raw == null ? EmptyRecipe() : (RecipeInfo)StdLib.Deserialize(raw);
        }

        [Safe]
        public static string[] GetRecipeVersions(string recipeId)
        {
            return ReadStringList(VersionMap(), RecipeVersionKey(recipeId));
        }

        public static void UpsertRecipe(
            string recipeId,
            string version,
            ByteString moduleRefs,
            ByteString requiredFields,
            ByteString operationSchema,
            string allowedRuntimeMode,
            string routerTemplateId,
            ByteString compatibilityMetadata,
            bool active)
        {
            ValidateAdmin();
            ValidateIdentifier(recipeId, "recipe id");
            ValidateIdentifier(version, "version");

            string normalizedMode = allowedRuntimeMode ?? "";
            string normalizedRouterTemplateId = routerTemplateId ?? "";

            ExecutionEngine.Assert(normalizedMode.Length <= 64, "mode too long");
            ExecutionEngine.Assert(normalizedRouterTemplateId.Length <= 128, "router template id too long");

            RecipeInfo info = new RecipeInfo
            {
                RecipeId = recipeId,
                Version = version,
                ModuleRefs = NormalizeBlob(moduleRefs),
                RequiredFields = NormalizeBlob(requiredFields),
                OperationSchema = NormalizeBlob(operationSchema),
                AllowedRuntimeMode = normalizedMode,
                RouterTemplateId = normalizedRouterTemplateId,
                CompatibilityMetadata = NormalizeBlob(compatibilityMetadata),
                Active = active,
                UpdatedAt = Runtime.Time,
                UpdatedBy = Runtime.Transaction.Sender
            };

            RecipeMap().Put(RecipeKey(recipeId, version), StdLib.Serialize(info));

            string[] versions = ReadStringList(VersionMap(), RecipeVersionKey(recipeId));
            WriteStringList(VersionMap(), RecipeVersionKey(recipeId), AppendUnique(versions, version));

            OnRecipeUpserted(recipeId, version, normalizedMode, active);
        }

        public static void SetRecipeActive(string recipeId, string version, bool active)
        {
            ValidateAdmin();

            RecipeInfo info = GetRecipe(recipeId, version);
            ExecutionEngine.Assert(info.RecipeId.Length > 0, "recipe not found");

            if (info.Active == active) return;

            info.Active = active;
            info.UpdatedAt = Runtime.Time;
            info.UpdatedBy = Runtime.Transaction.Sender;
            RecipeMap().Put(RecipeKey(recipeId, version), StdLib.Serialize(info));

            OnRecipeStatusChanged(recipeId, version, active);
        }

        public static void SetModuleRegistry(UInt160 moduleRegistry)
        {
            ValidateAdmin();

            UInt160 normalized = NormalizeOptionalAddress(moduleRegistry);
            UInt160 oldRegistry = ModuleRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_MODULE_REGISTRY, normalized);
            OnModuleRegistryChanged(oldRegistry, normalized);
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
