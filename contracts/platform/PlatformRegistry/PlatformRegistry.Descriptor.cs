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
                // The directory copy only advances when the parameter was
                // actually applied — a spend-threshold RAISE schedules a
                // timelocked pending row instead and syncs the directory at
                // execute time (audit: instant raises made the cumulative
                // instant bound effectively always the 10000 GAS max).
                if (ApplyRegistryDescriptor(appId, key, value))
                {
                    StoreDescriptor(appId, key, value);
                    OnDescriptorApplied(appId, key);
                }
                return;
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
        // the same grammar engines apply to their own namespaces. Returns
        // true when the parameter was applied (directory copy + event fire);
        // false when it was scheduled for timelocked execution instead.
        private static bool ApplyRegistryDescriptor(string appId, string key, object value)
        {
            if (key == KEY_SPEND_THRESHOLD)
            {
                BigInteger threshold = (BigInteger)value;
                ExecutionEngine.Assert(
                    threshold >= MIN_SPEND_THRESHOLD && threshold <= MAX_SPEND_THRESHOLD,
                    "spend threshold out of range");
                if (threshold <= SpendThresholdOf(appId))
                {
                    // Tightening is always safe and instant; it also
                    // supersedes any pending raise.
                    Storage.Put(Storage.CurrentContext, AppKey(PREFIX_SPEND_THRESHOLD, appId), threshold);
                    Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_VALUE, appId));
                    Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_ETA, appId));
                    return true;
                }
                // Raises widen the cumulative instant-spend bound, so they
                // ride the estate's 24h timelock like every other
                // authority-widening change.
                BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
                Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_VALUE, appId), threshold);
                Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_ETA, appId), executeAfter);
                OnSpendThresholdRaiseScheduled(appId, threshold, executeAfter);
                return false;
            }
            ExecutionEngine.Assert(false, "unknown registry descriptor key");
            return false;
        }

        /// <summary>Apply a scheduled spend-threshold raise after its 24h
        /// timelock. App-admin gated like the descriptor lane itself.</summary>
        public static void ExecuteSpendThresholdRaise(string appId)
        {
            RequireNotGloballyPaused();
            RequireRegistered(appId);
            RequireAppNotPaused(appId);
            RequireAppAdmin(appId);
            ByteString rawEta = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_ETA, appId));
            ExecutionEngine.Assert(rawEta != null, "no pending threshold raise");
            ExecutionEngine.Assert(Runtime.Time >= (BigInteger)rawEta, "timelock active");
            BigInteger threshold = (BigInteger)Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_VALUE, appId));
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_SPEND_THRESHOLD, appId), threshold);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_VALUE, appId));
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_ETA, appId));
            StoreDescriptor(appId, KEY_SPEND_THRESHOLD, threshold);
            OnDescriptorApplied(appId, KEY_SPEND_THRESHOLD);
        }

        /// <summary>Cancel a scheduled spend-threshold raise. App-admin gated.</summary>
        public static void CancelSpendThresholdRaise(string appId)
        {
            RequireRegistered(appId);
            RequireAppAdmin(appId);
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_VALUE, appId));
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_THRESHOLD_ETA, appId));
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
