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
    /// Central routing gateway for the composable miniapp platform.
    ///
    /// The ServiceGateway is the "kernel" for contract interactions. MiniApps and
    /// off-chain callers route operations through this gateway, which resolves the
    /// correct module contract for each binding and forwards the call.
    ///
    /// ARCHITECTURE:
    /// Caller -> ServiceGateway.Execute(instanceId, binding, method, args)
    ///        -> validates authorization + instance status
    ///        -> resolves binding to module contract hash
    ///        -> Contract.Call(moduleHash, method, CallFlags.All, instanceId, args)
    ///
    /// MULTI-TENANCY:
    /// Module bindings are namespaced by instance ID. Each instance has its own
    /// set of binding-name-to-module-hash mappings provisioned from its recipe.
    ///
    /// AUTHORIZATION MODEL:
    /// - Platform admin: full control, configure registries, initialize instances
    /// - Instance controller (owner/operator from MiniAppInstanceRegistry): execute operations
    /// - Read-only queries: unrestricted via Query()
    ///
    /// STORAGE LAYOUT:
    /// - 0x01       admin address
    /// - 0x02       MiniAppInstanceRegistry contract hash
    /// - 0x03       ModuleRegistry contract hash
    /// - 0x10       module bindings per instance: instanceId + binding -> UInt160
    /// - 0x11       instance binding list: instanceId -> string[] (binding names)
    /// - 0x12       instance initialized flag: instanceId -> bool
    /// </summary>
    [DisplayName("ServiceGateway")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Central routing gateway for composable miniapp module interactions")]
    [ContractPermission("*", "*")]
    public class ServiceGateway : SmartContract
    {
        #region Storage Prefixes

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_INSTANCE_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_MODULE_REGISTRY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_MODULE_BINDING = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_BINDING_LIST = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_INSTANCE_INITIALIZED = new byte[] { 0x12 };

        #endregion

        #region Events

        [DisplayName("OperationRouted")]
        public static event Action<string, string, string, UInt160> OnOperationRouted = delegate { };

        [DisplayName("ModuleBindingSet")]
        public static event Action<string, string, UInt160> OnModuleBindingSet = delegate { };

        [DisplayName("InstanceInitialized")]
        public static event Action<string, string, int> OnInstanceInitialized = delegate { };

        [DisplayName("InstanceRegistryChanged")]
        public static event Action<UInt160, UInt160> OnInstanceRegistryChanged = delegate { };

        [DisplayName("ModuleRegistryChanged")]
        public static event Action<UInt160, UInt160> OnModuleRegistryChanged = delegate { };

        [DisplayName("AdminChanged")]
        public static event Action<UInt160, UInt160> OnAdminChanged = delegate { };

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Internal Helpers

        private static StorageMap BindingMap() => new StorageMap(Storage.CurrentContext, PREFIX_MODULE_BINDING);
        private static StorageMap BindingListMap() => new StorageMap(Storage.CurrentContext, PREFIX_BINDING_LIST);
        private static StorageMap InitializedMap() => new StorageMap(Storage.CurrentContext, PREFIX_INSTANCE_INITIALIZED);

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        private static void ValidateIdentifier(string value, string label)
        {
            string normalized = value ?? "";
            ExecutionEngine.Assert(normalized.Length > 0, label + " required");
            ExecutionEngine.Assert(normalized.Length <= 128, label + " too long");
        }

        private static void ValidateAddress(UInt160 value, string label)
        {
            ExecutionEngine.Assert(value != UInt160.Zero && value.IsValid, "invalid " + label);
        }

        private static UInt160 NormalizeOptionalAddress(UInt160 value)
        {
            if (value == UInt160.Zero) return UInt160.Zero;
            ExecutionEngine.Assert(value.IsValid, "invalid address");
            return value;
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

        /// <summary>
        /// Build the storage key for a specific module binding within an instance.
        /// Layout: instanceId + "|" + binding
        /// </summary>
        private static ByteString BindingKey(string instanceId, string binding)
        {
            return (ByteString)((instanceId ?? "") + "|" + (binding ?? ""));
        }

        /// <summary>
        /// Build the storage key for the binding list of an instance.
        /// </summary>
        private static ByteString BindingListKey(string instanceId)
        {
            return (ByteString)(instanceId ?? "");
        }

        /// <summary>
        /// Build the storage key for the initialized flag of an instance.
        /// </summary>
        private static ByteString InitializedKey(string instanceId)
        {
            return (ByteString)(instanceId ?? "");
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

        #endregion

        #region Instance Authorization

        /// <summary>
        /// Check whether the caller is authorized to execute operations on an instance.
        /// Authorization is granted to: platform admin, instance owner, or instance operator.
        /// Owner/operator are retrieved from MiniAppInstanceRegistry via cross-contract call.
        /// </summary>
        private static bool IsInstanceController(string instanceId)
        {
            if (IsAdminWitness()) return true;

            UInt160 registry = InstanceRegistry();
            if (registry == UInt160.Zero || !registry.IsValid) return false;

            // Retrieve instance info from MiniAppInstanceRegistry
            ByteString? raw = (ByteString?)Contract.Call(
                registry, "getInstance", CallFlags.ReadOnly,
                new object[] { instanceId });

            if (raw == null) return false;

            // Deserialize to access Owner and Operator fields.
            // The struct is MiniAppInstanceRegistry.InstanceInfo which serializes as an array.
            object[] fields = (object[])StdLib.Deserialize(raw);
            // InstanceInfo field order:
            //   0: InstanceId, 1: AppId, 2: RecipeId, 3: RecipeVersion,
            //   4: RuntimeMode, 5: Owner, 6: Operator, 7: Developer,
            //   8: RouterContract, 9: ModuleBindings, 10: ConfigHash,
            //   11: FrontendRef, 12: Status, 13: UpgradePending, 14: UpdatedAt

            // Check owner witness
            ByteString ownerRaw = (ByteString)fields[5];
            if (ownerRaw != null && ownerRaw.Length == 20)
            {
                UInt160 owner = (UInt160)ownerRaw;
                if (owner != UInt160.Zero && owner.IsValid && Runtime.CheckWitness(owner))
                {
                    return true;
                }
            }

            // Check operator (may be a contract calling via CallingScriptHash)
            ByteString operatorRaw = (ByteString)fields[6];
            if (operatorRaw != null && operatorRaw.Length == 20)
            {
                UInt160 op = (UInt160)operatorRaw;
                if (op != UInt160.Zero && op.IsValid)
                {
                    if (Runtime.CheckWitness(op) || Runtime.CallingScriptHash == op)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Validate that the instance is active (not paused/disabled) in MiniAppInstanceRegistry.
        /// MiniAppInstanceStatus: Pending=0, Active=1, Paused=2, Disabled=3
        /// </summary>
        private static void RequireActiveInstance(string instanceId)
        {
            // First check that the instance has been initialized in this gateway
            ByteString? initialized = InitializedMap().Get(InitializedKey(instanceId));
            ExecutionEngine.Assert(initialized != null && (BigInteger)initialized == 1,
                "instance not initialized in gateway");

            UInt160 registry = InstanceRegistry();
            ExecutionEngine.Assert(registry != UInt160.Zero && registry.IsValid,
                "instance registry not set");

            // Retrieve instance info from MiniAppInstanceRegistry
            ByteString? raw = (ByteString?)Contract.Call(
                registry, "getInstance", CallFlags.ReadOnly,
                new object[] { instanceId });

            ExecutionEngine.Assert(raw != null, "instance not found in registry");

            object[] fields = (object[])StdLib.Deserialize(raw);
            // Field 0 is InstanceId -- must be non-empty
            string registeredId = (string)(ByteString)fields[0];
            ExecutionEngine.Assert(registeredId != null && registeredId.Length > 0,
                "instance not registered");

            // Field 12 is Status (MiniAppInstanceStatus enum, byte)
            // Active = 1
            BigInteger status = (BigInteger)(ByteString)fields[12];
            ExecutionEngine.Assert(status == 1, "instance not active");
        }

        /// <summary>
        /// Validate that a module contract hash is registered and active in ModuleRegistry.
        /// </summary>
        private static void ValidateModuleRegistered(string instanceId, string binding, UInt160 moduleHash)
        {
            UInt160 moduleRegistry = ModuleRegistryAddress();
            if (moduleRegistry == UInt160.Zero || !moduleRegistry.IsValid)
            {
                // If no module registry is configured, skip validation.
                // This allows bootstrapping before the registry is set.
                return;
            }

            bool isModuleActive = (bool)Contract.Call(
                moduleRegistry, "isModuleActive", CallFlags.ReadOnly,
                new object[] { moduleHash });

            ExecutionEngine.Assert(isModuleActive, "module not active in registry");

            UInt160 instanceRegistry = InstanceRegistry();
            if (instanceRegistry == UInt160.Zero || !instanceRegistry.IsValid)
            {
                return;
            }

            string[] bindingRef = (string[])Contract.Call(
                instanceRegistry, "resolveModuleBinding", CallFlags.ReadOnly,
                new object[] { instanceId, binding });

            ExecutionEngine.Assert(bindingRef != null && bindingRef.Length == 2,
                "binding not declared in instance");

            string moduleId = bindingRef[0] ?? "";
            string version = bindingRef[1] ?? "";
            ExecutionEngine.Assert(moduleId.Length > 0 && version.Length > 0,
                "binding not declared in instance");

            ByteString? instanceRaw = (ByteString?)Contract.Call(
                instanceRegistry, "getInstance", CallFlags.ReadOnly,
                new object[] { instanceId });
            ExecutionEngine.Assert(instanceRaw != null, "instance not found in registry");

            object[] instanceFields = (object[])StdLib.Deserialize(instanceRaw);
            string recipeId = (string)(ByteString)instanceFields[2];
            string recipeVersion = (string)(ByteString)instanceFields[3];

            UInt160 recipeRegistry = (UInt160)Contract.Call(
                instanceRegistry, "recipeRegistry", CallFlags.ReadOnly,
                new object[] { });

            if (recipeRegistry != UInt160.Zero && recipeRegistry.IsValid)
            {
                string[] recipeBindingRef = (string[])Contract.Call(
                    recipeRegistry, "resolveRecipeBinding", CallFlags.ReadOnly,
                    new object[] { recipeId, recipeVersion, binding });

                ExecutionEngine.Assert(recipeBindingRef != null && recipeBindingRef.Length == 2,
                    "binding not declared in recipe");
                ExecutionEngine.Assert(recipeBindingRef[0] == moduleId && recipeBindingRef[1] == version,
                    "binding not approved by recipe");
            }

            UInt160 expectedModuleHash = (UInt160)Contract.Call(
                moduleRegistry, "resolveModuleHash", CallFlags.ReadOnly,
                new object[] { moduleId, version });

            ExecutionEngine.Assert(expectedModuleHash != UInt160.Zero && expectedModuleHash.IsValid,
                "binding resolves to unknown module");
            ExecutionEngine.Assert(expectedModuleHash == moduleHash,
                "binding hash mismatch");
        }

        #endregion

        #region Safe Queries

        [Safe]
        public static UInt160 Admin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        [Safe]
        public static UInt160 InstanceRegistry()
        {
            return ReadAddress(PREFIX_INSTANCE_REGISTRY);
        }

        [Safe]
        public static UInt160 ModuleRegistryAddress()
        {
            return ReadAddress(PREFIX_MODULE_REGISTRY);
        }

        /// <summary>
        /// Get the module contract hash for a specific binding within an instance.
        /// Returns UInt160.Zero if no binding exists.
        /// </summary>
        [Safe]
        public static UInt160 GetModuleBinding(string instanceId, string binding)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(binding, "binding");

            ByteString? raw = BindingMap().Get(BindingKey(instanceId, binding));
            if (raw == null || raw.Length == 0)
            {
                return UInt160.Zero;
            }

            return (UInt160)raw;
        }

        /// <summary>
        /// Get all binding names for an instance.
        /// </summary>
        [Safe]
        public static string[] GetAllBindingNames(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            return ReadStringList(BindingListMap(), BindingListKey(instanceId));
        }

        /// <summary>
        /// Get all bindings for an instance as parallel arrays of names and hashes.
        /// Returns a two-element array: [string[] names, UInt160[] hashes].
        /// Neo N3 does not support Map as a return type, so we use parallel arrays.
        /// </summary>
        [Safe]
        public static object[] GetAllBindings(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");

            string[] names = ReadStringList(BindingListMap(), BindingListKey(instanceId));
            UInt160[] hashes = new UInt160[names.Length];

            for (int i = 0; i < names.Length; i++)
            {
                ByteString? raw = BindingMap().Get(BindingKey(instanceId, names[i]));
                hashes[i] = (raw == null || raw.Length == 0) ? UInt160.Zero : (UInt160)raw;
            }

            return new object[] { names, hashes };
        }

        /// <summary>
        /// Check whether an instance has been initialized in this gateway.
        /// </summary>
        [Safe]
        public static bool IsInstanceInitialized(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            ByteString? raw = InitializedMap().Get(InitializedKey(instanceId));
            return raw != null && (BigInteger)raw == 1;
        }

        /// <summary>
        /// Get the number of bindings for an instance.
        /// </summary>
        [Safe]
        public static int GetBindingCount(string instanceId)
        {
            ValidateIdentifier(instanceId, "instance id");
            string[] names = ReadStringList(BindingListMap(), BindingListKey(instanceId));
            return names.Length;
        }

        #endregion

        #region Operation Routing

        /// <summary>
        /// Route a state-changing operation to the module bound under the given binding name.
        ///
        /// FLOW:
        /// 1. Validate caller is authorized for the instance (admin, owner, or operator)
        /// 2. Validate instance is active (not paused/disabled)
        /// 3. Resolve binding to module contract hash
        /// 4. Forward call: Contract.Call(moduleHash, method, CallFlags.All, instanceId, args)
        /// 5. Emit OperationRouted event
        ///
        /// The module contract receives instanceId as the first argument followed by
        /// the caller-supplied args array elements. This matches the multi-tenant module
        /// calling convention used by PrepaidGasModule, CheckinModule, etc.
        /// </summary>
        public static object Execute(string instanceId, string binding, string method, object[] args)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(binding, "binding");
            ValidateIdentifier(method, "method");

            // Authorization: caller must be instance controller
            ExecutionEngine.Assert(IsInstanceController(instanceId), "unauthorized: not instance controller");

            // Instance must be active
            RequireActiveInstance(instanceId);

            // Resolve binding to module hash
            UInt160 moduleHash = GetModuleBinding(instanceId, binding);
            ExecutionEngine.Assert(moduleHash != UInt160.Zero && moduleHash.IsValid,
                "binding not found: " + binding);

            // Build the forwarded argument array: [instanceId, ...args]
            object[] forwardedArgs = BuildForwardedArgs(instanceId, args);

            // Forward the call to the module contract
            object result = Contract.Call(moduleHash, method, CallFlags.All, forwardedArgs);

            OnOperationRouted(instanceId, binding, method, Runtime.Transaction.Sender);

            return result;
        }

        /// <summary>
        /// Route a read-only query to the module bound under the given binding name.
        ///
        /// Unlike Execute(), this does not require authorization or active-instance checks.
        /// Read-only queries are open to all callers. The module is invoked with
        /// CallFlags.ReadOnly to prevent state changes.
        /// </summary>
        [Safe]
        public static object Query(string instanceId, string binding, string method, object[] args)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(binding, "binding");
            ValidateIdentifier(method, "method");

            // Resolve binding to module hash
            UInt160 moduleHash = GetModuleBinding(instanceId, binding);
            ExecutionEngine.Assert(moduleHash != UInt160.Zero && moduleHash.IsValid,
                "binding not found: " + binding);

            // Build the forwarded argument array: [instanceId, ...args]
            object[] forwardedArgs = BuildForwardedArgs(instanceId, args);

            // Forward the read-only call to the module contract
            return Contract.Call(moduleHash, method, CallFlags.ReadOnly, forwardedArgs);
        }

        /// <summary>
        /// Build the forwarded argument array by prepending instanceId to the caller args.
        /// Module contracts expect instanceId as the first parameter in their multi-tenant API.
        /// </summary>
        private static object[] BuildForwardedArgs(string instanceId, object[] args)
        {
            if (args == null || args.Length == 0)
            {
                return new object[] { instanceId };
            }

            object[] forwarded = new object[args.Length + 1];
            forwarded[0] = instanceId;
            for (int i = 0; i < args.Length; i++)
            {
                forwarded[i + 1] = args[i];
            }

            return forwarded;
        }

        #endregion

        #region Module Binding Management

        /// <summary>
        /// Set or update a single module binding for an instance.
        /// Only the platform admin or instance controller (owner/operator) may call this.
        /// The module contract hash must correspond to a deployed contract.
        /// </summary>
        public static bool SetModuleBinding(string instanceId, string binding, UInt160 moduleContractHash)
        {
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(binding, "binding");
            ValidateAddress(moduleContractHash, "module contract hash");

            // Authorization: admin or instance controller
            ExecutionEngine.Assert(IsInstanceController(instanceId), "unauthorized: not instance controller");

            // Validate the module contract is deployed
            ValidateModuleRegistered(instanceId, binding, moduleContractHash);

            // Store the binding
            BindingMap().Put(BindingKey(instanceId, binding), moduleContractHash);

            // Update the binding name list
            string[] names = ReadStringList(BindingListMap(), BindingListKey(instanceId));
            WriteStringList(BindingListMap(), BindingListKey(instanceId), AppendUnique(names, binding));

            OnModuleBindingSet(instanceId, binding, moduleContractHash);

            return true;
        }

        /// <summary>
        /// Initialize a new instance in the gateway with its full set of recipe bindings.
        ///
        /// This is typically called once during instance provisioning, after the instance
        /// is registered in MiniAppInstanceRegistry. It sets all module bindings at once
        /// and marks the instance as initialized.
        ///
        /// Only the platform admin may initialize instances. This prevents unauthorized
        /// binding of arbitrary module contracts to instance IDs.
        ///
        /// The moduleBindingNames and moduleBindingHashes arrays must be the same length
        /// and represent parallel arrays: moduleBindingNames[i] maps to moduleBindingHashes[i].
        /// </summary>
        public static bool InitializeInstance(
            string instanceId,
            string recipeId,
            string[] moduleBindingNames,
            UInt160[] moduleBindingHashes)
        {
            ValidateAdmin();
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(recipeId, "recipe id");

            // Ensure parallel arrays match in length
            ExecutionEngine.Assert(moduleBindingNames != null, "binding names required");
            ExecutionEngine.Assert(moduleBindingHashes != null, "binding hashes required");
            ExecutionEngine.Assert(moduleBindingNames.Length == moduleBindingHashes.Length,
                "binding names and hashes length mismatch");
            ExecutionEngine.Assert(moduleBindingNames.Length > 0, "at least one binding required");

            // Prevent double-initialization
            ByteString? existing = InitializedMap().Get(InitializedKey(instanceId));
            ExecutionEngine.Assert(existing == null || (BigInteger)existing != 1,
                "instance already initialized");

            // Set each binding
            string[] allNames = new string[moduleBindingNames.Length];
            for (int i = 0; i < moduleBindingNames.Length; i++)
            {
                string name = moduleBindingNames[i];
                UInt160 hash = moduleBindingHashes[i];

                ValidateIdentifier(name, "binding name");
                ValidateAddress(hash, "module hash");
                ValidateModuleRegistered(instanceId, name, hash);

                BindingMap().Put(BindingKey(instanceId, name), hash);
                allNames[i] = name;
            }

            // Store the binding list
            WriteStringList(BindingListMap(), BindingListKey(instanceId), allNames);

            // Mark as initialized
            InitializedMap().Put(InitializedKey(instanceId), 1);

            OnInstanceInitialized(instanceId, recipeId, moduleBindingNames.Length);

            return true;
        }

        /// <summary>
        /// Remove a specific module binding from an instance.
        /// Only admin may remove bindings to prevent accidental breakage.
        /// </summary>
        public static bool RemoveModuleBinding(string instanceId, string binding)
        {
            ValidateAdmin();
            ValidateIdentifier(instanceId, "instance id");
            ValidateIdentifier(binding, "binding");

            // Verify binding exists
            ByteString? raw = BindingMap().Get(BindingKey(instanceId, binding));
            ExecutionEngine.Assert(raw != null && raw.Length > 0, "binding not found");

            // Remove the binding
            BindingMap().Delete(BindingKey(instanceId, binding));

            // Remove from the name list
            string[] names = ReadStringList(BindingListMap(), BindingListKey(instanceId));
            string[] updated = RemoveFromList(names, binding);
            WriteStringList(BindingListMap(), BindingListKey(instanceId), updated);

            OnModuleBindingSet(instanceId, binding, UInt160.Zero);

            return true;
        }

        /// <summary>
        /// Remove a value from a string array, preserving order.
        /// </summary>
        private static string[] RemoveFromList(string[] values, string toRemove)
        {
            int count = 0;
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] != toRemove) count++;
            }

            if (count == values.Length) return values;

            string[] result = new string[count];
            int idx = 0;
            for (int i = 0; i < values.Length; i++)
            {
                if (values[i] != toRemove)
                {
                    result[idx] = values[i];
                    idx++;
                }
            }

            return result;
        }

        #endregion

        #region Admin Management

        /// <summary>
        /// Transfer admin role to a new address.
        /// Requires current admin signature.
        /// </summary>
        public static bool SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin, "admin");

            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);

            return true;
        }

        /// <summary>
        /// Set the MiniAppInstanceRegistry contract address.
        /// The gateway queries this registry to resolve instance owner/operator and status.
        /// </summary>
        public static bool SetInstanceRegistry(UInt160 registryHash)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registryHash);

            UInt160 oldRegistry = InstanceRegistry();
            Storage.Put(Storage.CurrentContext, PREFIX_INSTANCE_REGISTRY, normalized);
            OnInstanceRegistryChanged(oldRegistry, normalized);

            return true;
        }

        /// <summary>
        /// Set the ModuleRegistry contract address.
        /// The gateway uses this to validate that module contract hashes are registered.
        /// </summary>
        public static bool SetModuleRegistry(UInt160 registryHash)
        {
            ValidateAdmin();
            UInt160 normalized = NormalizeOptionalAddress(registryHash);

            UInt160 oldRegistry = ModuleRegistryAddress();
            Storage.Put(Storage.CurrentContext, PREFIX_MODULE_REGISTRY, normalized);
            OnModuleRegistryChanged(oldRegistry, normalized);

            return true;
        }

        #endregion
    }
}
