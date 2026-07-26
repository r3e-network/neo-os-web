using System.Numerics;
using System.Text;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // TestEngine behavioral suite for the PlatformRegistry spine: credit
    // ledger, permissionless registration, engine table lifecycle,
    // descriptor forwarding, and governance timelocks (design section 8,
    // layer 1).
    public class PlatformRegistryTests
    {
        [Fact]
        public void Deploy_AdminIsSenderWithCleanDefaults()
        {
            var ctx = Deploy();
            Assert.Equal(ctx.PlatformAdmin, ctx.Registry.admin());
            var pause = ctx.Registry.getGlobalPause();
            Assert.NotNull(pause);
            Assert.False(AsBool(pause![0]));
            Assert.Equal(BigInteger.Zero, AsInt(pause[1]));
            Assert.Equal(BigInteger.Zero, ctx.Registry.totalCreditLiability());
            Assert.Equal(BigInteger.Zero, ctx.Registry.accruedFees());
            Assert.Equal(BigInteger.Zero, ctx.Registry.artifactVersion());
        }

        [Fact]
        public void Credit_MemoDepositCreditsLedgerAndLiability()
        {
            var ctx = Deploy();
            DepositCredit(ctx, ctx.PlatformAdmin, "credit-app", 3 * GAS_UNIT);
            Assert.Equal(new BigInteger(3 * GAS_UNIT), ctx.Registry.creditOf("credit-app", ctx.PlatformAdmin));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), ctx.Registry.totalCreditLiability());

            // Attribution is (appId, payer)-scoped, never payer-global.
            Assert.Equal(BigInteger.Zero, ctx.Registry.creditOf("other-app", ctx.PlatformAdmin));

            // Direct invocation (calling script is not GAS) is refused; when
            // globally paused the pause gate fires FIRST (ordering pin).
            AsAdmin(ctx);
            AssertRevert("only GAS accepted", () => ctx.Registry.onNEP17Payment(ctx.PlatformAdmin, 1, "credit-app:credit"));
            ctx.Registry.setGlobalPaused(true);
            AssertRevert("registry paused", () => ctx.Registry.onNEP17Payment(ctx.PlatformAdmin, 1, "credit-app:credit"));
        }

        [Fact]
        public void Credit_ByteArrayMemoUsesSharedPaymentRouter()
        {
            var ctx = Deploy();
            AsAdmin(ctx);
            Assert.True(ctx.Engine.Native.GAS.Transfer(
                ctx.PlatformAdmin,
                ctx.Registry.Hash,
                GAS_UNIT,
                Encoding.UTF8.GetBytes("byte-credit-app:credit")) == true);

            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.creditOf("byte-credit-app", ctx.PlatformAdmin));
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.totalCreditLiability());
        }

        [Fact]
        public void WithdrawCredit_WitnessGatedAndPauseImmune()
        {
            var ctx = Deploy();
            DepositCredit(ctx, ctx.PlatformAdmin, "credit-app", 3 * GAS_UNIT);

            // A signer with no balance under this (appId, payer) cannot pull.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("insufficient credit", () => ctx.Registry.withdrawCredit("credit-app", GAS_UNIT));

            // The payer's exit works even while GLOBALLY PAUSED (anchor
            // invariant: witness-gated exits are pause-immune).
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(true);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(ctx.PlatformAdmin) ?? 0;
            ctx.Registry.withdrawCredit("credit-app", 2 * GAS_UNIT);
            Assert.Equal(before + 2 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(ctx.PlatformAdmin));
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.creditOf("credit-app", ctx.PlatformAdmin));
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.totalCreditLiability());
        }

        [Fact]
        public void RegisterApp_PermissionlessLiteTier_FeeFromPrepaidCredit()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            FundGas(ctx, appAdmin, 5 * GAS_UNIT);

            // No prepaid credit -> the M-11 anti-spam fee cannot be paid.
            As(ctx, appAdmin);
            AssertRevert("insufficient credit", () => ctx.Registry.registerApp("lite-app", "", appAdmin, null));

            DepositCredit(ctx, appAdmin, "lite-app", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("lite-app", "", appAdmin, null);

            // Fee consumed from (appId, appAdmin) credit and accrued as revenue.
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.creditOf("lite-app", appAdmin));
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Registry.totalCreditLiability());
            Assert.Equal(new BigInteger(FEE_LITE), ctx.Registry.accruedFees());

            // Directory row: lite tier has no engine and no account, payout
            // defaults to the app admin, active reflects pause state.
            var row = ctx.Registry.getApp("lite-app")!;
            Assert.Equal(6, row.Length);
            Assert.Equal("", AsString(row[0]));
            Assert.Equal(UInt160.Zero, AsHash(row[1]));
            Assert.Equal(appAdmin, AsHash(row[2]));
            Assert.Equal(UInt160.Zero, AsHash(row[3]));
            Assert.False(AsBool(row[4]));
            Assert.True(AsBool(row[5]));
            Assert.Equal(appAdmin, ctx.Registry.appAdminOf("lite-app"));
            // No auto-seeded payout (finding 1): a spend destination must be
            // installed explicitly through the timelocked setter.
            Assert.Equal(UInt160.Zero, ctx.Registry.payoutAddressOf("lite-app"));

            // Duplicate appIds are rejected (uniqueness is identity).
            DepositCredit(ctx, appAdmin, "lite-app", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            AssertRevert("appId already registered", () => ctx.Registry.registerApp("lite-app", "", appAdmin, null));
        }

        [Fact]
        public void RegisterApp_ValidationGates()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;

            // Witness of someone other than the declared appAdmin is refused.
            AsAdmin(ctx);
            AssertRevert("app admin witness required", () => ctx.Registry.registerApp("gate-app", "", appAdmin, null));

            // appId format: length bound and JSON-safe charset (manifest-name material).
            As(ctx, appAdmin);
            AssertRevert("invalid appId", () => ctx.Registry.registerApp(new string('a', 65), "", appAdmin, null));
            AssertRevert("invalid appId", () => ctx.Registry.registerApp("Bad:Colon", "", appAdmin, null));
            AssertRevert("invalid appId", () => ctx.Registry.registerApp("bad\"quote", "", appAdmin, null));
            AssertRevert("invalid appId", () => ctx.Registry.registerApp("", "", appAdmin, null));

            AssertRevert("appId reserved for platform registration",
                () => ctx.Registry.registerApp("miniapp-reserved", "", appAdmin, null));
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("miniapp-reserved", "", appAdmin, null);

            // A lite registration cannot carry descriptor entries.
            AssertRevert("descriptor requires an engine",
                () => ctx.Registry.registerAppByPlatform("gate-app", "", appAdmin, VmMap(("x:y", 1))));

            // Registration freezes under the global kill switch.
            ctx.Registry.setGlobalPaused(true);
            AssertRevert("registry paused", () => ctx.Registry.registerAppByPlatform("gate-app", "", appAdmin, null));
        }

        [Fact]
        public void RegisterAppByPlatform_PipelineLaneIsFeeExempt()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("pipeline-app", "", appAdmin, null);
            Assert.Equal(appAdmin, ctx.Registry.appAdminOf("pipeline-app"));
            Assert.Equal(BigInteger.Zero, ctx.Registry.accruedFees());

            // The pipeline lane is platform-admin gated.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized", () => ctx.Registry.registerAppByPlatform("other-app", "", appAdmin, null));
        }

        [Fact]
        public void EngineTable_TimelockedRegistrationAndRetirement()
        {
            var ctx = Deploy();

            // Propose is platform-admin gated.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized", () => ctx.Registry.proposeEngine(EngineId, ctx.EngineMock.Hash, 1));

            AsAdmin(ctx);
            AssertRevert("no pending engine change", () => ctx.Registry.registerEngine(EngineId));
            ctx.Registry.proposeEngine(EngineId, ctx.EngineMock.Hash, 1);
            AssertRevert("timelock active", () => ctx.Registry.registerEngine(EngineId));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.registerEngine(EngineId);

            var row = ctx.Registry.getEngine(EngineId)!;
            Assert.Equal(ctx.EngineMock.Hash, AsHash(row[0]));
            Assert.Equal(BigInteger.One, AsInt(row[1]));
            Assert.True(AsBool(row[2]));
            Assert.Equal(EngineId, ctx.Registry.engineIdOfHash(ctx.EngineMock.Hash));

            // NEW-I-2: a hash with no deployed contract cannot be executed in.
            ctx.Registry.proposeEngine("ghost-engine", TestEngine.GetNewSigner().Account, 1);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            AssertRevert("engine is not a deployed contract", () => ctx.Registry.registerEngine("ghost-engine"));

            // Retirement is the same timelocked pair; a retired row stops
            // new attachments without touching registered identities.
            ctx.Registry.proposeRetireEngine(EngineId);
            AssertRevert("timelock active", () => ctx.Registry.retireEngine(EngineId));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.retireEngine(EngineId);
            Assert.False(AsBool(ctx.Registry.getEngine(EngineId)![2]));

            var appAdmin = TestEngine.GetNewSigner().Account;
            AssertRevert("engine not active",
                () => ctx.Registry.registerAppByPlatform("late-app", EngineId, appAdmin, null));
        }

        [Fact]
        public void ProposeEngine_RejectsReservedRegistryNamespace()
        {
            // Finding 6: an engine named "registry" would make its descriptor
            // keys ("registry:param") collide with the registry-owned namespace
            // that SetDescriptor consumes locally, so the engine's own keys
            // would become unreachable. The reserved id is rejected outright.
            var ctx = Deploy();
            AsAdmin(ctx);
            AssertRevert("engineId reserved",
                () => ctx.Registry.proposeEngine("registry", ctx.EngineMock.Hash, 1));

            // A non-reserved id still registers normally.
            ctx.Registry.proposeEngine("registry-lane", ctx.EngineMock.Hash, 1);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.registerEngine("registry-lane");
            Assert.True(AsBool(ctx.Registry.getEngine("registry-lane")![2]));
        }

        [Fact]
        public void RegisterApp_WithEngine_PushesActivateAppIntoEngine()
        {
            var ctx = Deploy();
            RegisterEngine(ctx, EngineId, ctx.EngineMock.Hash);
            var appAdmin = TestEngine.GetNewSigner().Account;

            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("engine-app", EngineId, appAdmin,
                VmMap((EngineId + ":limit", 250)));
            Assert.Equal(BigInteger.One, ctx.EngineMock.activationCountOf("engine-app"));
            Assert.Equal(appAdmin, ctx.EngineMock.activatedAdminOf("engine-app"));
            Assert.Equal(BigInteger.One, ctx.EngineMock.activationDescriptorKeysOf("engine-app"));
            Assert.Equal(EngineId, ctx.Registry.engineOf("engine-app"));
            object[] account = ctx.Registry.getAppAbstractAccount("engine-app")!;
            Assert.NotEqual(UInt160.Zero, AsHash(account[1]));
            Assert.True(AsBool(account[2]));
            var row = ctx.Registry.getApp("engine-app")!;
            Assert.Equal(ctx.EngineMock.Hash, AsHash(row[1]));

            // The registry keeps the directory copy of every pushed entry.
            Assert.Equal(new BigInteger(250), AsInt(ctx.Registry.getDescriptor("engine-app", EngineId + ":limit")));

            // Registration descriptors outside the engine namespace are refused.
            AssertRevert("descriptor key outside engine namespace",
                () => ctx.Registry.registerAppByPlatform("engine-app-2", EngineId, appAdmin, VmMap(("other:limit", 1))));
        }

        [Fact]
        public void AttachEngine_UpgradesLiteRowAndRepushes()
        {
            var ctx = Deploy();
            RegisterEngine(ctx, EngineId, ctx.EngineMock.Hash);
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("lite-then-engine", "", appAdmin, null);

            // Attachment is the app admin's own power.
            AssertRevert("unauthorized: not app admin", () => ctx.Registry.attachEngine("lite-then-engine", EngineId));
            As(ctx, appAdmin);
            ctx.Registry.attachEngine("lite-then-engine", EngineId);
            Assert.Equal(EngineId, ctx.Registry.engineOf("lite-then-engine"));
            Assert.Equal(BigInteger.One, ctx.EngineMock.activationCountOf("lite-then-engine"));
            object[] account = ctx.Registry.getAppAbstractAccount("lite-then-engine")!;
            Assert.NotEqual(UInt160.Zero, AsHash(account[1]));
            Assert.True(AsBool(account[2]));

            // Re-attaching the same engine row is refused.
            AssertRevert("engine already attached", () => ctx.Registry.attachEngine("lite-then-engine", EngineId));
        }

        [Fact]
        public void SetDescriptor_ForwardsToEngineSideValidation()
        {
            var ctx = Deploy();
            RegisterEngine(ctx, EngineId, ctx.EngineMock.Hash);
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("desc-app", EngineId, appAdmin, null);

            // App-admin witness required.
            AssertRevert("unauthorized: not app admin",
                () => ctx.Registry.setDescriptor("desc-app", EngineId + ":limit", 500));

            // Forwarded to engine.validateAndApplyDescriptor and recorded on
            // both sides (registry copy is the directory audit trail).
            As(ctx, appAdmin);
            ctx.Registry.setDescriptor("desc-app", EngineId + ":limit", 500);
            Assert.Equal(new BigInteger(500), AsInt(ctx.EngineMock.appliedDescriptorOf("desc-app", EngineId + ":limit")));
            Assert.Equal(new BigInteger(500), AsInt(ctx.Registry.getDescriptor("desc-app", EngineId + ":limit")));

            // Engine-side rejection propagates: descriptors are consumed
            // engine-side WITH BOUNDS, never rubber-stamped.
            AsAdmin(ctx);
            ctx.EngineMock.setRejectDescriptors(true);
            As(ctx, appAdmin);
            AssertRevert("engine rejects descriptor",
                () => ctx.Registry.setDescriptor("desc-app", EngineId + ":limit", 900));

            // Namespace grammar: keys outside the attached engine are refused.
            AssertRevert("descriptor key outside engine namespace",
                () => ctx.Registry.setDescriptor("desc-app", "other-engine:limit", 1));

            // Registry-owned namespace: spendThreshold within bounds only.
            ctx.Registry.setDescriptor("desc-app", "registry:spendThreshold", 5 * GAS_UNIT);
            Assert.Equal(new BigInteger(5 * GAS_UNIT), ctx.Registry.spendThresholdOf("desc-app"));
            AssertRevert("spend threshold out of range",
                () => ctx.Registry.setDescriptor("desc-app", "registry:spendThreshold", GAS_UNIT / 2));
            AssertRevert("unknown registry descriptor key",
                () => ctx.Registry.setDescriptor("desc-app", "registry:other", 1));
        }

        [Fact]
        public void PlatformAdminRotation_TimelockedProposeExecuteCancel()
        {
            var ctx = Deploy();
            var newAdmin = TestEngine.GetNewSigner().Account;

            AsAdmin(ctx);
            AssertRevert("no pending admin", () => ctx.Registry.executeAdminChange());
            ctx.Registry.proposeAdmin(newAdmin);
            AssertRevert("timelock active", () => ctx.Registry.executeAdminChange());

            // Cancel wipes the pending change.
            ctx.Registry.cancelAdminChange();
            AssertRevert("no pending admin", () => ctx.Registry.executeAdminChange());

            // Propose again and let the 24h timelock mature.
            ctx.Registry.proposeAdmin(newAdmin);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeAdminChange();
            Assert.Equal(newAdmin, ctx.Registry.admin());

            // The old admin's witness lost its authority.
            AssertRevert("unauthorized", () => ctx.Registry.setGlobalPaused(true));
            As(ctx, newAdmin);
            ctx.Registry.setGlobalPaused(true);
            Assert.True(AsBool(ctx.Registry.getGlobalPause()![0]));
        }

        [Fact]
        public void Pauses_PerAppAndGlobalWithRecordedPausedAt()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("pause-app", "", appAdmin, null);

            // Per-app pause: app admin or platform admin, never strangers.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized: not app or platform admin", () => ctx.Registry.setAppPaused("pause-app", true));
            As(ctx, appAdmin);
            ctx.Registry.setAppPaused("pause-app", true);
            Assert.True(ctx.Registry.isPaused("pause-app"));
            AsAdmin(ctx);
            ctx.Registry.setAppPaused("pause-app", false);
            Assert.False(ctx.Registry.isPaused("pause-app"));

            // Global pause records pausedAt and overrides every per-app read;
            // re-pausing never rewinds the recorded timestamp (the escape
            // window anchor).
            long nowMs = (long)ctx.Engine.PersistingBlock.Timestamp.TotalMilliseconds;
            ctx.Registry.setGlobalPaused(true);
            var pause = ctx.Registry.getGlobalPause()!;
            Assert.True(AsBool(pause[0]));
            BigInteger recordedAt = AsInt(pause[1]);
            Assert.True(recordedAt >= nowMs);
            Assert.True(ctx.Registry.isPaused("pause-app"));

            AdvanceMs(ctx, 60_000);
            ctx.Registry.setGlobalPaused(true);
            Assert.Equal(recordedAt, AsInt(ctx.Registry.getGlobalPause()![1]));

            ctx.Registry.setGlobalPaused(false);
            Assert.False(AsBool(ctx.Registry.getGlobalPause()![0]));
            Assert.False(ctx.Registry.isPaused("pause-app"));
        }

        [Fact]
        public void AppAdminRotation_TwoStepTimelocked()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            var nextAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("rotate-app", "", appAdmin, null);

            // Strangers cannot propose; the app admin can.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized: not app or platform admin",
                () => ctx.Registry.proposeAppAdmin("rotate-app", nextAdmin));
            As(ctx, appAdmin);
            ctx.Registry.proposeAppAdmin("rotate-app", nextAdmin);
            AssertRevert("timelock active", () => ctx.Registry.executeAppAdminChange("rotate-app"));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeAppAdminChange("rotate-app");
            Assert.Equal(nextAdmin, ctx.Registry.appAdminOf("rotate-app"));

            // The displaced key lost the app's lanes.
            AssertRevert("unauthorized: not app or platform admin",
                () => ctx.Registry.proposeAppAdmin("rotate-app", appAdmin));
        }

        [Fact]
        public void ScheduledUpdate_TimelockedAndHashPinned()
        {
            var ctx = Deploy();
            var (nef, manifest) = Load("PlatformRegistry");
            byte[] nefBytes = System.IO.File.ReadAllBytes(
                System.IO.Path.Combine(BuildDir, "PlatformRegistry.nef"));
            string manifestJson = manifest.ToJson().ToString();

            AsAdmin(ctx);
            AssertRevert("no upgrade scheduled", () => ctx.Registry.update(nefBytes, manifestJson));
            ctx.Registry.scheduleUpdate(nefBytes, manifestJson);
            AssertRevert("timelock active", () => ctx.Registry.update(nefBytes, manifestJson));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);

            // The executed artifact must match the scheduled sha256 pin.
            AssertRevert("upgrade data mismatch", () => ctx.Registry.update(nefBytes, manifestJson + " "));
            ctx.Registry.update(nefBytes, manifestJson);

            // State survives the in-place upgrade.
            Assert.Equal(ctx.PlatformAdmin, ctx.Registry.admin());
        }
    }
}
