using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  AppAccount — outbound lanes, registry handshake, lifecycle relay
    //  (docs/platform-contract-library-v2.md section 4: spend / governance
    //  / exit)
    // ===================================================================
    public partial class AppAccount
    {
        // Escape window: 30 days in milliseconds, mirroring
        // AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS = 30 * 24 * 60 * 60
        // (framework/utils/aa-account.ts:18, bounds 7-90 days).
        private const long ESCAPE_TIMELOCK_MS = 2_592_000_000L;

        // ===================================================================
        //  executeTransfer — the ONLY normal outbound path.
        //
        //  The account holds funds but decides nothing: every spend POLICY
        //  lives in the registry treasury, whose lanes are role-bound
        //  (timelocked payout address, engine-hash-bound pool funding). The
        //  destination parameter is deliberately named 'target' — it arrives
        //  here already role-bound upstream, and the free-destination name
        //  is banned fleet-wide.
        // ===================================================================
        public static void ExecuteTransfer(UInt160 asset, UInt160 target, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == RegistryOf(), "registry only");
            ExecutionEngine.Assert(!IsPaused(), "account paused");
            ValidateOutbound(asset, target, amount);
            TransferAsset(asset, target, amount);
            OnExecuted(AppIdOf(), asset, target, amount);
        }

        // ===================================================================
        //  escapeExecute — the credible-exit hatch.
        //
        //  App-admin witnessed, usable ONLY once a registry-reported global
        //  pause has lasted the full escape window, so a bricked or captured
        //  registry can never permanently trap the treasury. Destination is
        //  the stored app admin (role-bound). Pause-immune by design: the
        //  local paused flag never gates this exit (anchor invariant).
        // ===================================================================
        public static void EscapeExecute(UInt160 asset, BigInteger amount)
        {
            UInt160 admin = AdminOf();
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "app admin only");
            ValidateOutbound(asset, admin, amount);
            // REQUIRED REGISTRY ABI (pinned; Stage B implements it):
            //   [Safe] getGlobalPause() -> [paused(bool), pausedAt(ms)]
            object[] pauseState = (object[])Contract.Call(
                RegistryOf(), "getGlobalPause", CallFlags.ReadOnly);
            ExecutionEngine.Assert((bool)pauseState[0], "registry not globally paused");
            BigInteger pausedAt = (BigInteger)pauseState[1];
            BigInteger now = Runtime.Time;
            ExecutionEngine.Assert(now - pausedAt >= ESCAPE_TIMELOCK_MS, "escape window not open");
            TransferAsset(asset, admin, amount);
            OnEscaped(AppIdOf(), asset, amount);
        }

        // ===================================================================
        //  bindRegistry — the post-deploy handshake (design section 4.1):
        //  the registry calls this on the fresh account and asserts the
        //  echoed appId before recording the row (replaces the
        //  non-implementable "_deploy asserts deployer == registry").
        // ===================================================================
        public static string BindRegistry()
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == RegistryOf(), "registry only");
            return AppIdOf();
        }

        // ===================================================================
        //  onAdminRotated — registry-pushed cache refresh. Registry-side
        //  setAppAdmin completion pushes the new admin here atomically, so
        //  the locally cached escape key can never drift stale.
        // ===================================================================
        public static void OnAdminRotated(UInt160 newAdmin)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == RegistryOf(), "registry only");
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid && newAdmin != UInt160.Zero, "invalid app admin");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_ADMIN, (ByteString)newAdmin);
            OnAdminRefreshed(AppIdOf(), newAdmin);
        }

        // ===================================================================
        //  update — registry-orchestrated only. The platform timelock AND
        //  the per-app consent flag are enforced registry-side before the
        //  relay reaches this method (double-consent rule, design section 4).
        // ===================================================================
        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }

        // The update authority for a minted account IS its registry: consent
        // and timelock live registry-side, the shim only verifies the caller.
        private static void ValidateAdmin()
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == RegistryOf(), "registry only");
        }

        // ---- shared outbound helpers ----
        private static void ValidateOutbound(UInt160 asset, UInt160 target, BigInteger amount)
        {
            ExecutionEngine.Assert(asset == GAS.Hash || asset == NEO.Hash, "unsupported asset");
            ExecutionEngine.Assert(target != null && target.IsValid && target != UInt160.Zero, "invalid target");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
        }

        private static void TransferAsset(UInt160 asset, UInt160 target, BigInteger amount)
        {
            if (asset == GAS.Hash)
            {
                ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, target, amount), "GAS transfer failed");
            }
            else
            {
                ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, target, amount), "NEO transfer failed");
            }
        }
    }
}
