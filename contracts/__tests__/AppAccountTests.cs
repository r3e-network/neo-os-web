using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ABI binding for the minted per-app treasury shim (design section 3.2 / 4).
    public abstract class AppAccountContract : SmartContract
    {
        protected AppAccountContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160? from, BigInteger amount, object? data);
        public abstract void executeTransfer(UInt160 asset, UInt160 target, BigInteger amount);
        public abstract void escapeExecute(UInt160 asset, BigInteger amount);
        public abstract string? bindRegistry();
        public abstract void onAdminRotated(UInt160 newAdmin);
        public abstract void setPaused(bool paused);
        public abstract void update(byte[] nef, string manifest);
        public abstract string? appIdOf();
        public abstract UInt160? registryOf();
        public abstract UInt160? adminOf();
        public abstract bool? isPaused();
    }

    // ABI binding for the in-engine registry counterparty fixture. It plays the
    // PlatformRegistry role for AppAccount tests: it exposes the pinned
    // getGlobalPause() read and relays calls so Runtime.CallingScriptHash on the
    // account genuinely equals the stored registry hash (the
    // TarotOracleMockFixture cross-contract-gate idiom).
    public abstract class RegistryMockContract : SmartContract
    {
        protected RegistryMockContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract object[]? getGlobalPause();
        public abstract void setGlobalPause(bool paused, BigInteger pausedAtMs);
        public abstract void callExecuteTransfer(UInt160 account, UInt160 asset, UInt160 target, BigInteger amount);
        public abstract string? callBindRegistry(UInt160 account);
        public abstract void callOnAdminRotated(UInt160 account, UInt160 newAdmin);
        public abstract void callSetPaused(UInt160 account, bool paused);
        public abstract void callUpdate(UInt160 account, byte[] nef, string manifest);
    }

    public class AppAccountTests
    {
        private const long GAS_UNIT = 100_000_000;                 // 1 GAS in base units
        private const long ESCAPE_TIMELOCK_MS = 2_592_000_000L;    // 30 days, mirrors aa-account.ts

        private const string AppId = "demo-app";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private sealed record Harness(
            TestEngine Engine,
            RegistryMockContract Registry,
            AppAccountContract Account,
            UInt160 AppAdmin,
            byte[] AccountNefBytes,
            string AccountManifestJson);

        // Mint-shaped deploy: the canonical AppAccount NEF under a manifest whose
        // name is spliced to the appId, initData = [appId, registryHash, appAdmin]
        // exactly as the registry's mint lane passes it (design section 4.1).
        private static Harness DeployHarness(string appId = AppId)
        {
            var engine = new TestEngine(true);
            engine.SetTransactionSigners(engine.ValidatorsAddress);

            var (mockNef, mockManifest) = Load("RegistryMockFixture");
            var registry = engine.Deploy<RegistryMockContract>(mockNef, mockManifest);

            UInt160 appAdmin = TestEngine.GetNewSigner().Account;

            string nefPath = Path.Combine(BuildDir, "AppAccount.nef");
            string manifestPath = Path.Combine(BuildDir, "AppAccount.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            byte[] nefBytes = File.ReadAllBytes(nefPath);
            var nef = NefFile.Parse(nefBytes);
            var manifest = ContractManifest.Parse(File.ReadAllText(manifestPath));
            manifest.Name = appId;
            string manifestJson = manifest.ToJson().ToString();

            var account = engine.Deploy<AppAccountContract>(
                nef, manifest, new object[] { appId, registry.Hash, appAdmin });

            return new Harness(engine, registry, account, appAdmin, nefBytes, manifestJson);
        }

        private static void FundGas(Harness h, UInt160 to, BigInteger amount)
        {
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            bool? ok = h.Engine.Native.GAS.Transfer(h.Engine.ValidatorsAddress, to, amount, null);
            Assert.True(ok == true, "GAS funding transfer should succeed");
        }

        private static long NowMs(Harness h) =>
            (long)h.Engine.PersistingBlock.Timestamp.TotalMilliseconds;

        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        [Fact]
        public void Deploy_StoresInitDataAndExposesReads()
        {
            var h = DeployHarness();
            Assert.Equal(AppId, h.Account.appIdOf());
            Assert.Equal(h.Registry.Hash, h.Account.registryOf());
            Assert.Equal(h.AppAdmin, h.Account.adminOf());
            Assert.Equal(false, h.Account.isPaused());
        }

        [Fact]
        public void Deposits_AcceptGasAndNeo_RejectOtherAssets()
        {
            var h = DeployHarness();

            // GAS deposit lands (real native transfer drives OnNEP17Payment).
            FundGas(h, h.Account.Hash, 5 * GAS_UNIT);
            Assert.Equal(new BigInteger(5 * GAS_UNIT), h.Engine.Native.GAS.BalanceOf(h.Account.Hash));

            // NEO deposit lands too (v1 accepts GAS and NEO only).
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            bool? neoOk = h.Engine.Native.NEO.Transfer(h.Engine.ValidatorsAddress, h.Account.Hash, 10, null);
            Assert.True(neoOk == true, "NEO deposit transfer should succeed");
            Assert.Equal(new BigInteger(10), h.Engine.Native.NEO.BalanceOf(h.Account.Hash));

            // A third NEP-17 is rejected. A FAULTing callback inside a real token
            // transfer hangs the TestEngine host, so the rejection is exercised via
            // direct invocation (the calling script is not GAS/NEO) and pinned at
            // source level in AppAccountSourceSecurityTests.
            var stranger = TestEngine.GetNewSigner().Account;
            h.Engine.SetTransactionSigners(stranger);
            AssertRevert("only GAS or NEO accepted",
                () => h.Account.onNEP17Payment(stranger, 1, null));
        }

        [Fact]
        public void ExecuteTransfer_RegistryCallerLaneOnly()
        {
            var h = DeployHarness();
            FundGas(h, h.Account.Hash, 5 * GAS_UNIT);
            var payoutTarget = TestEngine.GetNewSigner().Account;

            // A stranger (direct invocation) is not the registry: FAULT.
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            AssertRevert("registry only",
                () => h.Account.executeTransfer(h.Engine.Native.GAS.Hash, payoutTarget, GAS_UNIT));

            // The registry-relayed call is the one normal outbound path.
            h.Registry.callExecuteTransfer(h.Account.Hash, h.Engine.Native.GAS.Hash, payoutTarget, GAS_UNIT);
            Assert.Equal(new BigInteger(GAS_UNIT), h.Engine.Native.GAS.BalanceOf(payoutTarget));
            Assert.Equal(new BigInteger(4 * GAS_UNIT), h.Engine.Native.GAS.BalanceOf(h.Account.Hash));

            // Guards: bad amount / bad asset via the registry lane still revert.
            AssertRevert("invalid amount",
                () => h.Registry.callExecuteTransfer(h.Account.Hash, h.Engine.Native.GAS.Hash, payoutTarget, 0));
            AssertRevert("unsupported asset",
                () => h.Registry.callExecuteTransfer(h.Account.Hash, h.Registry.Hash, payoutTarget, 1));
        }

        [Fact]
        public void ExecuteTransfer_MovesNeoAndSurvivesGasClaimCallback()
        {
            var h = DeployHarness();
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            Assert.True(h.Engine.Native.NEO.Transfer(h.Engine.ValidatorsAddress, h.Account.Hash, 10, null) == true);

            // Sending NEO out mints a GAS claim back to the account with
            // from == null; the accept-only callback must tolerate it or every
            // NEO exit would brick.
            var payoutTarget = TestEngine.GetNewSigner().Account;
            h.Registry.callExecuteTransfer(h.Account.Hash, h.Engine.Native.NEO.Hash, payoutTarget, 4);
            Assert.Equal(new BigInteger(4), h.Engine.Native.NEO.BalanceOf(payoutTarget));
            Assert.Equal(new BigInteger(6), h.Engine.Native.NEO.BalanceOf(h.Account.Hash));
        }

        [Fact]
        public void SetPaused_AppAdminWitnessOrRegistryCaller_PauseBlocksExecuteTransfer()
        {
            var h = DeployHarness();
            FundGas(h, h.Account.Hash, 2 * GAS_UNIT);
            var payoutTarget = TestEngine.GetNewSigner().Account;

            // A stranger can neither pause nor unpause.
            var stranger = TestEngine.GetNewSigner().Account;
            h.Engine.SetTransactionSigners(stranger);
            AssertRevert("app admin or registry only", () => h.Account.setPaused(true));

            // The app admin's local kill switch freezes the registry spend lane.
            h.Engine.SetTransactionSigners(h.AppAdmin);
            h.Account.setPaused(true);
            Assert.Equal(true, h.Account.isPaused());
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            AssertRevert("account paused",
                () => h.Registry.callExecuteTransfer(h.Account.Hash, h.Engine.Native.GAS.Hash, payoutTarget, GAS_UNIT));

            // Deposits stay open while paused (pausing intake would brick the
            // GAS-claim callback on NEO exits).
            FundGas(h, h.Account.Hash, GAS_UNIT);
            Assert.Equal(new BigInteger(3 * GAS_UNIT), h.Engine.Native.GAS.BalanceOf(h.Account.Hash));

            // The registry caller can flip the flag too.
            h.Registry.callSetPaused(h.Account.Hash, false);
            Assert.Equal(false, h.Account.isPaused());
            h.Registry.callExecuteTransfer(h.Account.Hash, h.Engine.Native.GAS.Hash, payoutTarget, GAS_UNIT);
            Assert.Equal(new BigInteger(GAS_UNIT), h.Engine.Native.GAS.BalanceOf(payoutTarget));
        }

        [Fact]
        public void EscapeExecute_DeniedBeforeWindow_AllowedAfter_AndPauseImmune()
        {
            var h = DeployHarness();
            FundGas(h, h.Account.Hash, 5 * GAS_UNIT);

            // Only the app admin's witness opens the hatch at all.
            var stranger = TestEngine.GetNewSigner().Account;
            h.Engine.SetTransactionSigners(stranger);
            AssertRevert("app admin only",
                () => h.Account.escapeExecute(h.Engine.Native.GAS.Hash, GAS_UNIT));

            // No registry-reported global pause: denied.
            h.Engine.SetTransactionSigners(h.AppAdmin);
            AssertRevert("registry not globally paused",
                () => h.Account.escapeExecute(h.Engine.Native.GAS.Hash, GAS_UNIT));

            // Paused just now: the 30-day window has not elapsed.
            long nowMs = NowMs(h);
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            h.Registry.setGlobalPause(true, nowMs);
            h.Engine.SetTransactionSigners(h.AppAdmin);
            AssertRevert("escape window not open",
                () => h.Account.escapeExecute(h.Engine.Native.GAS.Hash, GAS_UNIT));

            // One millisecond short of the window: still denied.
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            h.Registry.setGlobalPause(true, nowMs - ESCAPE_TIMELOCK_MS + 1);
            h.Engine.SetTransactionSigners(h.AppAdmin);
            AssertRevert("escape window not open",
                () => h.Account.escapeExecute(h.Engine.Native.GAS.Hash, GAS_UNIT));

            // Window fully elapsed: funds exit to the app admin (role-bound),
            // even while the account's own paused flag is set (exits are
            // pause-immune per the anchor invariant).
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            h.Registry.setGlobalPause(true, nowMs - ESCAPE_TIMELOCK_MS);
            h.Engine.SetTransactionSigners(h.AppAdmin);
            h.Account.setPaused(true);
            BigInteger before = h.Engine.Native.GAS.BalanceOf(h.AppAdmin) ?? 0;
            h.Account.escapeExecute(h.Engine.Native.GAS.Hash, GAS_UNIT);
            Assert.Equal(before + GAS_UNIT, h.Engine.Native.GAS.BalanceOf(h.AppAdmin));
            Assert.Equal(new BigInteger(4 * GAS_UNIT), h.Engine.Native.GAS.BalanceOf(h.Account.Hash));
        }

        [Fact]
        public void BindRegistry_HandshakeEchoesAppId_RegistryCallerOnly()
        {
            var h = DeployHarness();

            // The post-deploy handshake (design section 4.1): the registry calls
            // bindRegistry() on the fresh account and asserts the echoed appId.
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            Assert.Equal(AppId, h.Registry.callBindRegistry(h.Account.Hash));

            // Anyone else is refused.
            AssertRevert("registry only", () => h.Account.bindRegistry());
        }

        [Fact]
        public void OnAdminRotated_RegistryPushRefreshesCachedAdmin()
        {
            var h = DeployHarness();
            var newAdmin = TestEngine.GetNewSigner().Account;

            // Only the registry can push a rotation (closes the stale-escape-key
            // flaw: the cache follows registry-side setAppAdmin completion).
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            AssertRevert("registry only", () => h.Account.onAdminRotated(newAdmin));
            AssertRevert("invalid app admin",
                () => h.Registry.callOnAdminRotated(h.Account.Hash, UInt160.Zero));

            h.Registry.callOnAdminRotated(h.Account.Hash, newAdmin);
            Assert.Equal(newAdmin, h.Account.adminOf());

            // The old admin's witness no longer operates the account.
            h.Engine.SetTransactionSigners(h.AppAdmin);
            AssertRevert("app admin or registry only", () => h.Account.setPaused(true));

            // The new admin's does.
            h.Engine.SetTransactionSigners(newAdmin);
            h.Account.setPaused(true);
            Assert.Equal(true, h.Account.isPaused());
        }

        [Fact]
        public void Update_RegistryOrchestratedOnly_PreservesLocalState()
        {
            var h = DeployHarness();

            // Direct update attempts FAULT: consent + timelock live registry-side.
            h.Engine.SetTransactionSigners(h.Engine.ValidatorsAddress);
            AssertRevert("registry only",
                () => h.Account.update(h.AccountNefBytes, h.AccountManifestJson));

            // The registry-relayed update succeeds and the update path of _deploy
            // performs no re-init: local identity/admin state is preserved.
            h.Registry.callUpdate(h.Account.Hash, h.AccountNefBytes, h.AccountManifestJson);
            Assert.Equal(AppId, h.Account.appIdOf());
            Assert.Equal(h.Registry.Hash, h.Account.registryOf());
            Assert.Equal(h.AppAdmin, h.Account.adminOf());
        }
    }
}
