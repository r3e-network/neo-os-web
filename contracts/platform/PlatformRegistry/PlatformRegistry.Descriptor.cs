using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — descriptor lane (design section 3.1)
    //
    //  Keys are namespaced "engineId:param". The registry FORWARDS engine
    //  keys to engine.validateAndApplyDescriptor, which enforces per-engine
    //  validated ranges — descriptors are consumed engine-side with bounds,
    //  the structural fix for PlatformGame's dead config blob. The
    //  "registry:" namespace is validated and applied locally.
    // ===================================================================
    public partial class PlatformRegistry
    {
        private const string REGISTRY_NAMESPACE = "registry";
        private const string KEY_SPEND_THRESHOLD = "registry:spendThreshold";

        public static void SetDescriptor(string appId, string key, object value)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            RequireAppNotPaused(appId);
            RequireAppAdmin(appId);
            ExecutionEngine.Assert(
                key != null && key.Length > 0 && key.Length <= MAX_DESCRIPTOR_KEY_LENGTH,
                "invalid descriptor key");
            if (KeyInNamespace(key, REGISTRY_NAMESPACE))
            {
                ApplyRegistryDescriptor(appId, key, value);
                StoreDescriptor(appId, key, value);
            }
            else
            {
                string engineId = EngineIdOf(appId);
                ExecutionEngine.Assert(engineId.Length > 0, "no engine attached");
                ExecutionEngine.Assert(KeyInNamespace(key, engineId), "descriptor key outside engine namespace");
                EngineRow row = GetEngineRow(engineId);
                ExecutionEngine.Assert(row != null && row.Active, "engine not active");
                // Checks-effects-interactions: persist the directory copy
                // BEFORE the external engine call (finding 4). If the engine
                // rejects, the whole tx aborts and this write rolls back, so
                // the stored copy only ever reflects an accepted descriptor.
                StoreDescriptor(appId, key, value);
                Contract.Call(row.Hash, "validateAndApplyDescriptor", CallFlags.All, appId, key, value);
            }
            OnDescriptorApplied(appId, key);
        }

        [Safe]
        public static object GetDescriptor(string appId, string key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, DescriptorKey(appId, key));
            return raw == null ? null : StdLib.Deserialize(raw);
        }

        // ---- internals ----

        // Registry-owned descriptor parameters, range-validated locally with
        // the same grammar engines apply to their own namespaces.
        private static void ApplyRegistryDescriptor(string appId, string key, object value)
        {
            if (key == KEY_SPEND_THRESHOLD)
            {
                BigInteger threshold = (BigInteger)value;
                ExecutionEngine.Assert(
                    threshold >= MIN_SPEND_THRESHOLD && threshold <= MAX_SPEND_THRESHOLD,
                    "spend threshold out of range");
                Storage.Put(Storage.CurrentContext, AppKey(PREFIX_SPEND_THRESHOLD, appId), threshold);
                return;
            }
            ExecutionEngine.Assert(false, "unknown registry descriptor key");
        }

        private static void StoreDescriptor(string appId, string key, object value)
        {
            ExecutionEngine.Assert(
                key != null && key.Length > 0 && key.Length <= MAX_DESCRIPTOR_KEY_LENGTH,
                "invalid descriptor key");
            Storage.Put(Storage.CurrentContext, DescriptorKey(appId, key), StdLib.Serialize(value));
        }

        // 1 + 20 + 20 bytes: both variable components ride their Ripemd160
        // image to stay inside Neo's 64-byte storage key cap.
        private static ByteString DescriptorKey(string appId, string key) =>
            Helper.Concat(AppKey(PREFIX_DESCRIPTOR, appId), CryptoLib.Ripemd160((ByteString)key));

        private static bool KeyInNamespace(string key, string ns) =>
            key.Length > ns.Length + 1 && key.StartsWith(ns + ":");
    }
}
