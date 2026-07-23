using System;
using System.Numerics;
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
        public void ConfiguredRegistryCreatesUniqueSharedAccountsDuringRegistration()
        {
            Ctx ctx = Deploy();
            AbstractAccountCoreMockContract core = DeployCore(ctx);
            ActivateCore(ctx, core);
            UInt160 appAdmin = UInt160.Parse("0x1122334455667788990011223344556677889900");
            FundGas(ctx, appAdmin, 4 * GAS_UNIT);

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

            DepositCredit(ctx, appAdmin, "aa-app-two", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("aa-app-two", "", appAdmin, null);
            object[] second = ctx.Registry.getAppAbstractAccount("aa-app-two")!;
            Assert.NotEqual(firstId, AsHash(second[1]));
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
