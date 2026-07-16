using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Event delegates
    // ===================================================================
    public delegate void AppAccountReceivedHandler(string appId, UInt160 asset, UInt160 from, BigInteger amount);
    public delegate void AppAccountExecutedHandler(string appId, UInt160 asset, UInt160 target, BigInteger amount);
    public delegate void AppAccountEscapedHandler(string appId, UInt160 asset, BigInteger amount);
    public delegate void AppAccountAdminRefreshedHandler(string appId, UInt160 newAdmin);
    public delegate void AppAccountPausedChangedHandler(string appId, bool paused);

    // ===================================================================
    //  AppAccount — the minted per-app treasury shim
    //  (docs/platform-contract-library-v2.md sections 3.2 + 4)
    //
    //  One canonical audited NEF, deployed once per registered app by the
    //  PlatformRegistry with manifest name = appId (same NEF + unique name
    //  => unique contract-account address). The account HOLDS app-owned
    //  funds but decides nothing: all spend policy lives in the registry
    //  treasury, whose lanes are role-bound. Two-ledger doctrine: this
    //  account is app-owned money; refundable user balances live in engine
    //  (appId,payer) credit ledgers, never here.
    //
    //  STORAGE LAYOUT (local cache, push-refreshed by the registry)
    //    0x01  appId
    //    0x02  registry hash
    //    0x03  appAdmin (cached; refreshed via onAdminRotated push)
    //    0x04  paused (local kill switch over the registry spend lane)
    // ===================================================================
    [DisplayName("AppAccount")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Registry-minted per-app treasury account: accept-only GAS/NEO intake, registry-relayed outbound lane, timelocked app-admin escape hatch.")]
    // Narrow, named-method grants only (fleet convention: never (*,*)).
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer")]
    [ContractPermission("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd", "update")]
    // The registry hash arrives as deploy-time data, so the getGlobalPause
    // consult (escape hatch) needs a wildcard-target, named-method grant.
    [ContractPermission("*", "getGlobalPause")]
    public partial class AppAccount : SmartContract
    {
        // ---- storage prefixes ----
        private static readonly byte[] PREFIX_APP_ID = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };

        // appId bound (mirrors the registry's registerApp validation).
        private const int MAX_APP_ID_LENGTH = 64;

        // ---- events ----
        [DisplayName("Received")] public static event AppAccountReceivedHandler OnReceived;
        [DisplayName("Executed")] public static event AppAccountExecutedHandler OnExecuted;
        [DisplayName("Escaped")] public static event AppAccountEscapedHandler OnEscaped;
        [DisplayName("AdminRefreshed")] public static event AppAccountAdminRefreshedHandler OnAdminRefreshed;
        [DisplayName("PausedChanged")] public static event AppAccountPausedChangedHandler OnPausedChanged;

        // ===================================================================
        //  Lifecycle
        //  initData = [appId(string), registryHash(UInt160), appAdmin(UInt160)]
        //  On the update path there is NO re-init: local identity survives
        //  registry-orchestrated upgrades untouched.
        // ===================================================================
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            object[] init = (object[])data;
            ExecutionEngine.Assert(init != null && init.Length == 3, "invalid init data");
            string appId = (string)init[0];
            UInt160 registry = (UInt160)init[1];
            UInt160 appAdmin = (UInt160)init[2];
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= MAX_APP_ID_LENGTH, "invalid app id");
            ExecutionEngine.Assert(registry != null && registry.IsValid && registry != UInt160.Zero, "invalid registry");
            ExecutionEngine.Assert(appAdmin != null && appAdmin.IsValid && appAdmin != UInt160.Zero, "invalid app admin");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_ID, appId);
            Storage.Put(Storage.CurrentContext, PREFIX_REGISTRY, (ByteString)registry);
            Storage.Put(Storage.CurrentContext, PREFIX_APP_ADMIN, (ByteString)appAdmin);
        }

        // ===================================================================
        //  Intake — accept-only, zero outbound (money-contract convention)
        //
        //  v1 accepts GAS and NEO only. Fee attribution is the address
        //  itself: no memo discipline needed, every deposit emits Received.
        //  Deliberately NO pause gate here: every outbound NEO movement mints
        //  a GAS claim back to this account through a from == null callback,
        //  so pausing intake would FAULT that claim and brick NEO exits.
        // ===================================================================
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 asset = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(asset == GAS.Hash || asset == NEO.Hash, "only GAS or NEO accepted");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            // from == null is the native GAS-claim mint during a NEO movement.
            UInt160 source = from == null ? UInt160.Zero : from;
            OnReceived(AppIdOf(), asset, source, amount);
        }

        // ===================================================================
        //  [Safe] reads
        // ===================================================================
        [Safe]
        public static string AppIdOf() =>
            (string)Storage.Get(Storage.CurrentContext, PREFIX_APP_ID);

        [Safe]
        public static UInt160 RegistryOf() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_REGISTRY);

        [Safe]
        public static UInt160 AdminOf() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_APP_ADMIN);

        [Safe]
        public static bool IsPaused() =>
            Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != null;

        // ===================================================================
        //  Local kill switch (app-admin witness OR registry caller)
        //
        //  Pausing freezes the registry-relayed spend lane only. Intake stays
        //  open (see OnNEP17Payment) and the escape hatch stays usable: all
        //  witness-gated exits are pause-immune per the anchor invariant.
        // ===================================================================
        public static void SetPaused(bool paused)
        {
            ExecutionEngine.Assert(
                Runtime.CallingScriptHash == RegistryOf() || Runtime.CheckWitness(AdminOf()),
                "app admin or registry only");
            if (paused) Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, 1);
            else Storage.Delete(Storage.CurrentContext, PREFIX_PAUSED);
            OnPausedChanged(AppIdOf(), paused);
        }
    }
}
