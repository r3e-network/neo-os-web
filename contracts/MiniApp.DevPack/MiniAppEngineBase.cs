using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniAppEngineBase — the shared source every registry-anchored engine
    /// Compile-Includes (docs/platform-contract-library-v2.md section 3.5;
    /// lane B / engine side, since Neo N3 has no deployed-code inheritance).
    ///
    /// Provides the pieces the registry's engine ABI relies on:
    /// - the one canonical AppKey(appId, prefix[, id|addr]) storage kit
    ///   (previously re-implemented four times across the estate);
    /// - the (appId, payer) credit ledger WITH a mandatory per-app liability
    ///   counter — the census found solvency tracking in only 2 of 23 fleet
    ///   ledgers, so here the counter moves with every credit mutation;
    /// - the activateApp / validateAndApplyDescriptor plumbing asserting
    ///   caller == the stored PlatformRegistry hash;
    /// - the three reentrancy-lock granularities (contract / tenant /
    ///   account) as acquire/release helpers;
    /// - RequireRegistered / RequireAppAdminOrPlatformAdmin tenant gates;
    /// - the registry pause consult for state-changing lanes (exits stay
    ///   pause-immune by simply not calling it).
    ///
    /// RESERVED PREFIX MAP: 0x01-0x0F belong to this base (registry anchor,
    /// tenant rows, credit ledger, locks); concrete engine modules take
    /// 0x10 and up. Events are declared per concrete contract with the
    /// documented vocabulary — the compiler requires them on the deploying
    /// class, so this base declares none. Helpers only: every member is
    /// protected, so the base adds no methods to an engine's ABI by itself.
    /// </summary>
    public abstract class MiniAppEngineBase : SmartContract
    {
        // ---- base/registry prefixes (0x01-0x0F, the reserved band) ----
        protected static readonly byte[] PREFIX_REGISTRY = new byte[] { 0x01 };
        protected static readonly byte[] PREFIX_TENANT_ADMIN = new byte[] { 0x02 };
        protected static readonly byte[] PREFIX_TENANT_CREDIT = new byte[] { 0x03 };
        protected static readonly byte[] PREFIX_TENANT_LIABILITY = new byte[] { 0x04 };
        protected static readonly byte[] PREFIX_LOCK_CONTRACT = new byte[] { 0x05 };
        protected static readonly byte[] PREFIX_LOCK_TENANT = new byte[] { 0x06 };
        protected static readonly byte[] PREFIX_LOCK_ACCOUNT = new byte[] { 0x07 };

        #region AppKey kit — appId-namespaced storage keys

        /// <summary>appId + prefix: per-tenant scalars and counters.</summary>
        protected static byte[] AppKey(string appId, byte[] prefix) =>
            MiniAppStorageKeys.AppKey(appId, prefix);

        /// <summary>appId + prefix + BigInteger id: indexed tenant records.</summary>
        protected static byte[] AppKey(string appId, byte[] prefix, BigInteger id) =>
            MiniAppStorageKeys.AppKey(appId, prefix, id);

        /// <summary>appId + prefix + UInt160 addr: per-account tenant data.</summary>
        protected static byte[] AppKey(string appId, byte[] prefix, UInt160 addr) =>
            MiniAppStorageKeys.AppKey(appId, prefix, addr);

        #endregion

        #region Registry anchor

        /// <summary>The PlatformRegistry this engine trusts, or zero when unbound.</summary>
        protected static UInt160 RegistryHash()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_REGISTRY);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        /// <summary>
        /// Store the registry hash. The CONCRETE engine decides the gate
        /// (admin-gated setter, bind-once, deploy-time seed); this helper
        /// only validates the address shape.
        /// </summary>
        protected static void StoreRegistryHash(UInt160 registry)
        {
            ExecutionEngine.Assert(registry != null && registry.IsValid && registry != UInt160.Zero,
                "invalid registry");
            Storage.Put(Storage.CurrentContext, PREFIX_REGISTRY, registry);
        }

        /// <summary>
        /// Gate the registry's engine ABI: activateApp and
        /// validateAndApplyDescriptor arrive only as cross-contract pushes
        /// from the stored registry, never from wallets.
        /// </summary>
        protected static void RequireRegistryCaller()
        {
            UInt160 registry = RegistryHash();
            ExecutionEngine.Assert(registry != UInt160.Zero && registry.IsValid, "registry not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == registry, "registry only");
        }

        #endregion

        #region Tenant rows

        /// <summary>Tenant-row presence == registered on this engine.</summary>
        protected static bool IsTenantRegistered(string appId) =>
            appId != null && appId.Length > 0 &&
            Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_ADMIN)) != null;

        /// <summary>Assert the appId holds a tenant row on this engine.</summary>
        protected static void RequireRegistered(string appId)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ExecutionEngine.Assert(IsTenantRegistered(appId), "appId not registered");
        }

        /// <summary>The admin the registry pushed for this tenant.</summary>
        protected static UInt160 TenantAdminOf(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_ADMIN));
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        /// <summary>
        /// The activation half of the registry's engine ABI: asserts the
        /// caller is the registry and records (or refreshes, on re-attach)
        /// the tenant's admin row. Descriptor entries are applied by the
        /// concrete engine afterwards — economics validation is engine
        /// business, not plumbing.
        /// </summary>
        protected static void ActivateTenant(string appId, UInt160 appAdmin)
        {
            RequireRegistryCaller();
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64,
                "invalid appId");
            ExecutionEngine.Assert(appAdmin != null && appAdmin.IsValid && appAdmin != UInt160.Zero,
                "invalid app admin");
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_ADMIN), appAdmin);
        }

        /// <summary>
        /// Witness gate: the platform-wide admin OR the tenant's own admin.
        /// The platform admin address is resolved by the concrete engine
        /// (its own admin slot) and passed in, keeping this base free of a
        /// second admin definition.
        /// </summary>
        protected static void RequireAppAdminOrPlatformAdmin(string appId, UInt160 platformAdmin)
        {
            if (platformAdmin != UInt160.Zero && platformAdmin.IsValid &&
                Runtime.CheckWitness(platformAdmin))
            {
                return;
            }
            UInt160 appAdmin = TenantAdminOf(appId);
            ExecutionEngine.Assert(
                appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin),
                "unauthorized: not app or platform admin");
        }

        #endregion

        #region (appId, payer) credit ledger with per-app liability counter

        /// <summary>Prepaid credit of one payer under one tenant.</summary>
        protected static BigInteger TenantCreditOf(string appId, UInt160 payer)
            => MiniAppCreditLedger.Read((ByteString)AppKey(appId, PREFIX_TENANT_CREDIT, payer));

        /// <summary>
        /// Sum of all outstanding credits under one tenant — the solvency
        /// counter every engine ledger must keep (design section 8).
        /// </summary>
        protected static BigInteger TenantCreditLiability(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_TENANT_LIABILITY));
            return raw == null ? 0 : (BigInteger)raw;
        }

        /// <summary>Credit a payer and bump the tenant liability counter.</summary>
        protected static void AddTenantCredit(string appId, UInt160 payer, BigInteger amount)
            => MiniAppCreditLedger.Credit(
                (ByteString)AppKey(appId, PREFIX_TENANT_CREDIT, payer),
                (ByteString)AppKey(appId, PREFIX_TENANT_LIABILITY),
                amount);

        /// <summary>
        /// Debit a payer and the tenant liability counter together; asserts
        /// the balance covers the debit and the counter cannot underflow.
        /// </summary>
        protected static void ConsumeTenantCredit(string appId, UInt160 payer, BigInteger amount)
            => MiniAppCreditLedger.Debit(
                (ByteString)AppKey(appId, PREFIX_TENANT_CREDIT, payer),
                (ByteString)AppKey(appId, PREFIX_TENANT_LIABILITY),
                amount);

        #endregion

        #region Reentrancy locks — contract / tenant / account granularities

        /// <summary>Whole-engine lock (governance, upgrades of shared config).</summary>
        protected static void AcquireContractLock() => AcquireLock(PREFIX_LOCK_CONTRACT);
        protected static void ReleaseContractLock() => ReleaseLock(PREFIX_LOCK_CONTRACT);

        /// <summary>Per-tenant lock (settlement and treasury lanes of one appId).</summary>
        protected static void AcquireTenantLock(string appId) => AcquireLock(AppKey(appId, PREFIX_LOCK_TENANT));
        protected static void ReleaseTenantLock(string appId) => ReleaseLock(AppKey(appId, PREFIX_LOCK_TENANT));

        /// <summary>Per-account-within-tenant lock (credit exits).</summary>
        protected static void AcquireAccountLock(string appId, UInt160 account) =>
            AcquireLock(AppKey(appId, PREFIX_LOCK_ACCOUNT, account));
        protected static void ReleaseAccountLock(string appId, UInt160 account) =>
            ReleaseLock(AppKey(appId, PREFIX_LOCK_ACCOUNT, account));

        private static void AcquireLock(byte[] key)
        {
            ByteString held = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(held == null || (BigInteger)held == 0, "reentrancy");
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        private static void ReleaseLock(byte[] key) =>
            Storage.Delete(Storage.CurrentContext, key);

        #endregion

        #region Registry pause consult

        /// <summary>
        /// Gate a state-changing lane on the registry's pause view of this
        /// appId (global kill switch OR per-app pause). Read-only cross-call;
        /// a no-op while the engine is unbound. User exits never call this —
        /// withdrawals stay pause-immune by design.
        /// </summary>
        protected static void RequireRegistryNotPaused(string appId)
        {
            UInt160 registry = RegistryHash();
            if (registry == UInt160.Zero || !registry.IsValid) return;
            bool paused = (bool)Contract.Call(registry, "isPaused", CallFlags.ReadOnly, appId);
            ExecutionEngine.Assert(!paused, "registry paused");
        }

        #endregion
    }
}
