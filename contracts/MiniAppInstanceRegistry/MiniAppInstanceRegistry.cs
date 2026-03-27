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
    public enum MiniAppInstanceStatus : byte
    {
        Pending = 0,
        Active = 1,
        Paused = 2,
        Disabled = 3
    }

    /// <summary>
    /// Phase-1 registry skeleton for modular miniapp instances.
    /// Holds canonical instance bindings before shared-mode/router-mode execution flows are finalized.
    /// </summary>
    [DisplayName("MiniAppInstanceRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "0.1.0")]
    [ManifestExtra("Description", "Registry skeleton for modular miniapp instances and recipe bindings")]
    public class MiniAppInstanceRegistry : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_RECIPE_REGISTRY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_MODULE_REGISTRY = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_INSTANCE = new byte[] { 0x10 };

        public struct InstanceInfo
        {
            public string InstanceId;
            public string AppId;
            public string RecipeId;
            public string RecipeVersion;
            public string RuntimeMode;
            public UInt160 Owner;
            public UInt160 Operator;
            public UInt160 Developer;
            public UInt160 RouterContract;
            public ByteString ModuleBindings;
            public ByteString ConfigHash;
            public string FrontendRef;
            public MiniAppInstanceStatus Status;
            public bool UpgradePending;
            public ulong UpdatedAt;
        }

        [DisplayName("InstanceRegistered")]
        public static event Action<string, string, string, string> OnInstanceRegistered = delegate { };

        [DisplayName("InstanceStatusChanged")]
        public static event Action<string, MiniAppInstanceStatus, MiniAppInstanceStatus, bool> OnInstanceStatusChanged = delegate { };

        [DisplayName("InstanceRouterBound")]
        public static event Action<string, UInt160> OnInstanceRouterBound = delegate { };

        [DisplayName("AppRegistryChanged")]
        public static event Action<UInt160, UInt160> OnAppRegistryChanged = delegate { };

        [DisplayName("RecipeRegistryChanged")]
        public static event Action<UInt160, UInt160> OnRecipeRegistryChanged = delegate { };

        [DisplayName("ModuleRegistryChanged")]
        public static event Action<UInt160, UInt160> OnModuleRegistryChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        private static StorageMap InstanceMap() => new StorageMap(Storage.CurrentContext, PREFIX_INSTANCE);

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static bool IsAdminWitness()
        {
            UInt160 admin = Admin();
            return admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin);
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static UInt160 NormalizeRequiredAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
            return value;
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
        }

        private static ByteString NormalizeBlob(ByteString value)
        {
            return value ?? (ByteString)"";
        }

        private static ByteString InstanceKey(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return (ByteString)(instanceId ?? "");
        }

        private static InstanceInfo EmptyInstance()
        {
            return new InstanceInfo
            {
                InstanceId = "",
                AppId = "",
                RecipeId = "",
                RecipeVersion = "",
                RuntimeMode = "",
                Owner = UInt160.Zero,
                Operator = UInt160.Zero,
                Developer = UInt160.Zero,
                RouterContract = UInt160.Zero,
                ModuleBindings = (ByteString)"",
                ConfigHash = (ByteString)"",
                FrontendRef = "",
                Status = MiniAppInstanceStatus.Pending,
                UpgradePending = false,
                UpdatedAt = 0
            };
        }

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 AppRegistry()
        {
            return ReadAddress(PREFIX_APP_REGISTRY);
        }

        [Safe]
        public static UInt160 RecipeRegistry()
        {
            return ReadAddress(PREFIX_RECIPE_REGISTRY);
        }

        [Safe]
        public static UInt160 ModuleRegistry()
        {
            return ReadAddress(PREFIX_MODULE_REGISTRY);
        }

        [Safe]
        public static InstanceInfo GetInstance(string instanceId)
        {
            ByteString? raw = InstanceMap().Get(InstanceKey(instanceId));
            return raw == null ? EmptyInstance() : (InstanceInfo)StdLib.Deserialize(raw);
        }

        public static void RegisterInstance(
            string instanceId,
            string appId,
            string recipeId,
            string recipeVersion,
            string runtimeMode,
            UInt160 owner,
            UInt160 operatorAddress,
            UInt160 developer,
            UInt160 routerContract,
            ByteString moduleBindings,
            ByteString configHash,
            string frontendRef)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(appId, "app id");
            ValidateIdentifier(recipeId, "recipe id");
            ValidateIdentifier(recipeVersion, "recipe version");
            ValidateIdentifier(runtimeMode, "runtime mode");

            UInt160 normalizedOwner = NormalizeRequiredAddress(owner, "owner");
            UInt160 normalizedDeveloper = NormalizeRequiredAddress(developer, "developer");

            bool authorized =
                IsAdminWitness() ||
                Runtime.CheckWitness(normalizedOwner) ||
                Runtime.CheckWitness(normalizedDeveloper);
            ExecutionEngine.Assert(authorized, "unauthorized");

            ByteString key = InstanceKey(instanceId);
            ByteString? existing = InstanceMap().Get(key);
            ExecutionEngine.Assert(existing == null, "instance exists");

            string normalizedFrontendRef = frontendRef ?? "";
            ExecutionEngine.Assert(normalizedFrontendRef.Length <= 512, "frontend ref too long");

            InstanceInfo info = new InstanceInfo
            {
                InstanceId = instanceId,
                AppId = appId,
                RecipeId = recipeId,
                RecipeVersion = recipeVersion,
                RuntimeMode = runtimeMode,
                Owner = normalizedOwner,
                Operator = NormalizeOptionalAddress(operatorAddress),
                Developer = normalizedDeveloper,
                RouterContract = NormalizeOptionalAddress(routerContract),
                ModuleBindings = NormalizeBlob(moduleBindings),
                ConfigHash = NormalizeBlob(configHash),
                FrontendRef = normalizedFrontendRef,
                Status = MiniAppInstanceStatus.Pending,
                UpgradePending = false,
                UpdatedAt = Runtime.Time
            };

            InstanceMap().Put(key, StdLib.Serialize(info));
            OnInstanceRegistered(instanceId, appId, recipeId, runtimeMode);
        }

        public static void SetInstanceStatus(string instanceId, MiniAppInstanceStatus newStatus, bool upgradePending)
        {
            ValidateAdmin();

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");

            MiniAppInstanceStatus oldStatus = info.Status;
            info.Status = newStatus;
            info.UpgradePending = upgradePending;
            info.UpdatedAt = Runtime.Time;
            InstanceMap().Put(InstanceKey(instanceId), StdLib.Serialize(info));

            OnInstanceStatusChanged(instanceId, oldStatus, newStatus, upgradePending);
        }

        public static void BindRouterContract(string instanceId, UInt160 routerContract)
        {
            ValidateAdmin();

            InstanceInfo info = GetInstance(instanceId);
            ExecutionEngine.Assert(info.InstanceId.Length > 0, "instance not found");

            UInt160 normalizedRouter = NormalizeOptionalAddress(routerContract);
            info.RouterContract = normalizedRouter;
            info.UpdatedAt = Runtime.Time;
            InstanceMap().Put(InstanceKey(instanceId), StdLib.Serialize(info));

            OnInstanceRouterBound(instanceId, normalizedRouter);
        }

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();

            UInt160 normalized = NormalizeOptionalAddress(appRegistry);
            UInt160 oldRegistry = AppRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, normalized);
            OnAppRegistryChanged(oldRegistry, normalized);
        }

        public static void SetRecipeRegistry(UInt160 recipeRegistry)
        {
            ValidateAdmin();

            UInt160 normalized = NormalizeOptionalAddress(recipeRegistry);
            UInt160 oldRegistry = RecipeRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_RECIPE_REGISTRY, normalized);
            OnRecipeRegistryChanged(oldRegistry, normalized);
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
