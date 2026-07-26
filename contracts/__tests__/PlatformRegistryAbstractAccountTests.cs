using System;
using System.Numerics;
using System.Text;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class PlatformRegistryAbstractAccountTests
    {
        private static AbstractAccountCoreMockContract DeployCore(Ctx ctx)
        {
            var (nef, manifest) = Load("AbstractAccountCoreMockFixture");
            AbstractAccountCoreMockContract core = ctx.Engine.Deploy<AbstractAccountCoreMockContract>(nef, manifest);
            core.setRegistrar(ctx.Registry.Hash);
            return core;
        }

        private static void ActivateCore(Ctx ctx, AbstractAccountCoreMockContract core)
        {
            AsAdmin(ctx);
            ctx.Registry.proposeAbstractAccountCore(core.Hash);
            Assert.Equal(core.Hash, ctx.Registry.pendingAbstractAccountCore());
            AssertRevert("timelock active", () => ctx.Registry.setAbstractAccountCore());
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.setAbstractAccountCore();
            Assert.Equal(core.Hash, ctx.Registry.abstractAccountCore());
        }

        [Fact]
        public void CoreActivationRequiresReciprocalRegistrar()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            UInt160 otherRegistrar = UInt160.Parse("0x5566778899001122334455667788990011223344");
            core.setRegistrar(otherRegistrar);

            AsAdmin(ctx);
            AssertRevert(
                "abstract account core registrar mismatch",
                () => ctx.Registry.proposeAbstractAccountCore(core.Hash));

            core.setRegistrar(ctx.Registry.Hash);
            ctx.Registry.proposeAbstractAccountCore(core.Hash);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            core.setRegistrar(otherRegistrar);
            AssertRevert(
                "abstract account core registrar mismatch",
                () => ctx.Registry.setAbstractAccountCore());

            core.setRegistrar(ctx.Registry.Hash);
            ctx.Registry.setAbstractAccountCore();
            Assert.Equal(core.Hash, ctx.Registry.abstractAccountCore());
        }

        [Fact]
        public void EngineBoundRegistrationRequiresConfiguredCore()
        {
            Ctx ctx = Deploy();
            AsAdmin(ctx);
            ctx.Registry.proposeEngine(EngineId, ctx.EngineMock.Hash, 1);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.registerEngine(EngineId);

            UInt160 appAdmin = TestEngine.GetNewSigner().Account;
            AssertRevert(
                "abstract account core not set",
                () => ctx.Registry.registerAppByPlatform("engine-without-core", EngineId, appAdmin, null));
        }

        [Fact]
        public void ConfiguredRegistryCreatesUniqueSharedAccountsDuringRegistration()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 appAdmin = UInt160.Parse("0x1122334455667788990011223344556677889900");
            FundGas(ctx, appAdmin, 4 * GAS_UNIT);
            UInt160 registeredAccount = UInt160.Zero;
            ctx.Registry.OnAppRegistered += (_, _, _, accountHash) => registeredAccount = accountHash;

            DepositCredit(ctx, appAdmin, "aa-app-one", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("aa-app-one", "", appAdmin, null);

            object[] first = ctx.Registry.getAppAbstractAccount("aa-app-one")!;
            UInt160 firstCore = AsHash(first[0]);
            UInt160 firstId = AsHash(first[1]);
            Assert.Equal(core.Hash, firstCore);
            Assert.NotEqual(UInt160.Zero, firstId);
            Assert.True(AsBool(first[2]));
            Assert.Equal(appAdmin, core.getBackupOwner(firstId));
            Assert.Equal("aa-app-one", ctx.Registry.appIdOfAbstractAccount(core.Hash, firstId));
            Assert.Equal(firstId, registeredAccount);

            DepositCredit(ctx, appAdmin, "aa-app-two", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("aa-app-two", "", appAdmin, null);
            object[] second = ctx.Registry.getAppAbstractAccount("aa-app-two")!;
            Assert.NotEqual(firstId, AsHash(second[1]));
        }

        [Fact]
        public void RegistryBindingMatchesTheUnifiedSmartWalletDerivationOrder()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 appAdmin = UInt160.Parse("0x13ef519c362973f9a34648a9eac5b71250b2a80a");
            const string appId = "miniapp-jump-rush";
            FundGas(ctx, appAdmin, 3 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, appId, 2 * GAS_UNIT);

            byte[] registryBytes = ctx.Registry.Hash.GetSpan().ToArray();
            byte[] appIdBytes = Encoding.UTF8.GetBytes(appId);
            byte[] appBinding = new byte[registryBytes.Length + appIdBytes.Length];
            Buffer.BlockCopy(registryBytes, 0, appBinding, 0, registryBytes.Length);
            Buffer.BlockCopy(appIdBytes, 0, appBinding, registryBytes.Length, appIdBytes.Length);
            UInt160 expected = core.computeStablePlatformAccountId(
                appBinding,
                2_592_000);

            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform(appId, "", appAdmin, null);

            object[] row = ctx.Registry.getAppAbstractAccount(appId)!;
            Assert.Equal(expected, AsHash(row[1]));
            Assert.Equal(appAdmin, core.getBackupOwner(expected));
        }

        [Fact]
        public void AppAdminRotationPreservesSharedAccountAndUpdatesBackupOwner()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 previousAdmin = UInt160.Parse("0x5566778899001122334455667788990011223344");
            UInt160 newAdmin = UInt160.Parse("0x6677889900112233445566778899001122334455");
            const string appId = "aa-owner-rotation";
            FundGas(ctx, previousAdmin, 4 * GAS_UNIT);
            DepositCredit(ctx, previousAdmin, appId, 2 * GAS_UNIT);

            As(ctx, previousAdmin);
            ctx.Registry.registerApp(appId, "", previousAdmin, null);
            UInt160 accountId = AsHash(ctx.Registry.getAppAbstractAccount(appId)![1]);
            Assert.Equal(previousAdmin, core.getBackupOwner(accountId));

            ctx.Registry.proposeAppAdmin(appId, newAdmin);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeAppAdminChange(appId);

            Assert.Equal(newAdmin, ctx.Registry.appAdminOf(appId));
            Assert.Equal(accountId, AsHash(ctx.Registry.getAppAbstractAccount(appId)![1]));
            Assert.Equal(newAdmin, core.getBackupOwner(accountId));
        }

        [Fact]
        public void ExistingDirectoryRowCanBeMaterializedWithoutDeployingPerAppContract()
        {
            Ctx ctx = Deploy();
            UInt160 appAdmin = UInt160.Parse("0x2233445566778899001122334455667788990011");
            FundGas(ctx, appAdmin, 3 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, "legacy-lite-app", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("legacy-lite-app", "", appAdmin, null);
            Assert.False(AsBool(ctx.Registry.getAppAbstractAccount("legacy-lite-app")![2]));

            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 stranger = UInt160.Parse("0x3344556677889900112233445566778899001122");
            As(ctx, stranger);
            AssertRevert(
                "unauthorized: not app or platform admin",
                () => ctx.Registry.materializeAbstractAccount("legacy-lite-app"));

            AsAdmin(ctx);
            UInt160 accountId = ctx.Registry.materializeAbstractAccount("legacy-lite-app")!;
            Assert.Equal(appAdmin, core.getBackupOwner(accountId));
            Assert.Equal(accountId, ctx.Registry.materializeAbstractAccount("legacy-lite-app"));
        }

        [Fact]
        public void PredictedSharedAccountIsStableBeforeMaterialization()
        {
            Ctx ctx = Deploy();
            UInt160 appAdmin = UInt160.Parse("0x3344556677889900112233445566778899001122");
            const string appId = "legacy-predicted-app";
            FundGas(ctx, appAdmin, 3 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, appId, 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp(appId, "", appAdmin, null);

            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);

            object[] predicted = ctx.Registry.getPredictedAbstractAccount(appId)!;
            Assert.Equal(core.Hash, AsHash(predicted[0]));
            Assert.NotEqual(UInt160.Zero, AsHash(predicted[1]));
            Assert.False(AsBool(predicted[2]));

            AsAdmin(ctx);
            UInt160 materialized = ctx.Registry.materializeAbstractAccount(appId)!;
            Assert.Equal(materialized, AsHash(predicted[1]));
            object[] resolved = ctx.Registry.getPredictedAbstractAccount(appId)!;
            Assert.True(AsBool(resolved[2]));
            Assert.Equal(materialized, AsHash(resolved[1]));
        }

        [Fact]
        public void PredictedSharedAccountSurvivesAdminRotationBeforeMaterialization()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            UInt160 previousAdmin = UInt160.Parse("0x7788990011223344556677889900112233445566");
            UInt160 newAdmin = UInt160.Parse("0x8899001122334455667788990011223344556677");
            const string appId = "aa-predicted-owner-rotation";
            FundGas(ctx, previousAdmin, 4 * GAS_UNIT);
            DepositCredit(ctx, previousAdmin, appId, 2 * GAS_UNIT);

            As(ctx, previousAdmin);
            ctx.Registry.registerApp(appId, "", previousAdmin, null);
            ActivateCore(ctx, core);

            UInt160 predictedBefore = AsHash(ctx.Registry.getPredictedAbstractAccount(appId)![1]);
            ctx.Registry.proposeAppAdmin(appId, newAdmin);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeAppAdminChange(appId);

            Assert.Equal(newAdmin, ctx.Registry.appAdminOf(appId));
            UInt160 predictedAfter = AsHash(ctx.Registry.getPredictedAbstractAccount(appId)![1]);
            Assert.Equal(predictedBefore, predictedAfter);

            As(ctx, newAdmin);
            UInt160 materialized = ctx.Registry.materializeAbstractAccount(appId)!;
            Assert.Equal(predictedBefore, materialized);
            Assert.Equal(newAdmin, core.getBackupOwner(materialized));
        }

        [Fact]
        public void TimelockedCoreDisableStopsNewMaterializationWithoutDeletingExistingIdentity()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 appAdmin = UInt160.Parse("0x4455667788990011223344556677889900112233");
            FundGas(ctx, appAdmin, 5 * GAS_UNIT);

            DepositCredit(ctx, appAdmin, "aa-before-disable", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("aa-before-disable", "", appAdmin, null);
            object[] existing = ctx.Registry.getAppAbstractAccount("aa-before-disable")!;
            Assert.True(AsBool(existing[2]));

            AsAdmin(ctx);
            ctx.Registry.proposeAbstractAccountCore(UInt160.Zero);
            Assert.Equal(UInt160.Zero, ctx.Registry.pendingAbstractAccountCore());
            Assert.True(ctx.Registry.abstractAccountCoreAvailableAt() > 0);
            AssertRevert("timelock active", () => ctx.Registry.setAbstractAccountCore());
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.setAbstractAccountCore();
            Assert.Equal(UInt160.Zero, ctx.Registry.abstractAccountCore());

            DepositCredit(ctx, appAdmin, "aa-after-disable", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("aa-after-disable", "", appAdmin, null);
            Assert.False(AsBool(ctx.Registry.getAppAbstractAccount("aa-after-disable")![2]));
            Assert.True(AsBool(ctx.Registry.getAppAbstractAccount("aa-before-disable")![2]));
            AssertRevert(
                "abstract account core not set",
                () => ctx.Registry.materializeAbstractAccount("aa-after-disable"));
        }
    }
}
