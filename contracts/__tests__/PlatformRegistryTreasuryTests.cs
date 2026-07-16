using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // Treasury policy suite (design section 4.3): the spend-policy matrix
    // over the REAL minted AppAccount — role-bound lanes allowed, strangers
    // FAULT, exits pause-immune, escape-hatch ordering against the real
    // registry — plus the two-hop memo-routed engine pool funding and the
    // liability/fee conservation reads.
    public class PlatformRegistryTreasuryTests
    {
        private const long ESCAPE_TIMELOCK_MS = 2_592_000_000L; // 30 days (aa-account.ts mirror)
        private const string AppId = "treasury-app";

        private sealed class TreasuryCtx
        {
            public RegistryHarness.Ctx Ctx = null!;
            public UInt160 AppAdmin = null!;
            public UInt160 Account = null!;
            public AppAccountContract Shim = null!;
        }

        // Registered + minted app whose account is funded with 200 GAS.
        private static TreasuryCtx DeployTreasury(bool withEngine = false)
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            if (withEngine) RegisterEngine(ctx, EngineId, ctx.EngineMock.Hash);
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform(AppId, withEngine ? EngineId : "", appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount(AppId)!;
            FundGas(ctx, account, 200 * GAS_UNIT);
            return new TreasuryCtx
            {
                Ctx = ctx,
                AppAdmin = appAdmin,
                Account = account,
                Shim = ctx.Engine.FromHash<AppAccountContract>(account, false),
            };
        }

        [Fact]
        public void SpendToPayout_RoleBoundLane_StrangerFaults()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;

            // Default payout destination is the app admin (role-bound).
            Assert.Equal(t.AppAdmin, ctx.Registry.payoutAddressOf(AppId));

            // A stranger's witness cannot spend.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized: not app admin",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Even the PLATFORM admin has no spend path over app treasuries
            // ("admin cannot harvest", extended invariant).
            AsAdmin(ctx);
            AssertRevert("unauthorized: not app admin",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // The app admin's below-threshold spend lands at the payout address.
            As(ctx, t.AppAdmin);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin) ?? 0;
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 5 * GAS_UNIT);
            Assert.Equal(before + 5 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin));
            Assert.Equal(new BigInteger(195 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Account));

            // Direct calls on the shim itself stay refused: policy lives in
            // the registry, the account only obeys its registry caller.
            AssertRevert("registry only",
                () => t.Shim.executeTransfer(ctx.Engine.Native.GAS.Hash, t.AppAdmin, GAS_UNIT));
        }

        [Fact]
        public void SpendToPayout_AboveThresholdRequiresSpendTimelock()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;
            As(ctx, t.AppAdmin);

            // Default threshold is 100 GAS.
            Assert.Equal(new BigInteger(100 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));
            AssertRevert("amount above spend threshold",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 101 * GAS_UNIT));

            // The timelocked lane: propose -> wait 24h -> execute.
            AssertRevert("no pending spend", () => ctx.Registry.executeSpend(AppId));
            ctx.Registry.proposeSpend(AppId, ctx.Engine.Native.GAS.Hash, 150 * GAS_UNIT);
            AssertRevert("timelock active", () => ctx.Registry.executeSpend(AppId));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);

            // Execute stays witness-gated to the app admin.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized: not app admin", () => ctx.Registry.executeSpend(AppId));
            As(ctx, t.AppAdmin);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin) ?? 0;
            ctx.Registry.executeSpend(AppId);
            Assert.Equal(before + 150 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin));

            // The pending slot is consumed; cancel clears a fresh proposal.
            AssertRevert("no pending spend", () => ctx.Registry.executeSpend(AppId));
            ctx.Registry.proposeSpend(AppId, ctx.Engine.Native.GAS.Hash, 120 * GAS_UNIT);
            ctx.Registry.cancelSpend(AppId);
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            AssertRevert("no pending spend", () => ctx.Registry.executeSpend(AppId));
        }

        [Fact]
        public void PayoutAddressChange_Timelocked()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;
            var newPayout = TestEngine.GetNewSigner().Account;

            As(ctx, t.AppAdmin);
            AssertRevert("payout cannot be the registry",
                () => ctx.Registry.proposePayoutAddress(AppId, ctx.Registry.Hash));
            ctx.Registry.proposePayoutAddress(AppId, newPayout);
            AssertRevert("timelock active", () => ctx.Registry.executePayoutAddress(AppId));

            // A compromised key cannot instantly redirect: the old payout
            // address stays live until the 24h lock matures.
            Assert.Equal(t.AppAdmin, ctx.Registry.payoutAddressOf(AppId));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executePayoutAddress(AppId);
            Assert.Equal(newPayout, ctx.Registry.payoutAddressOf(AppId));

            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 2 * GAS_UNIT);
            Assert.Equal(new BigInteger(2 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(newPayout));
        }

        [Fact]
        public void SpendThresholdDescriptor_TightensTheDirectLane()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;
            As(ctx, t.AppAdmin);
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 5 * GAS_UNIT);
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 5 * GAS_UNIT);
            AssertRevert("amount above spend threshold",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 6 * GAS_UNIT));
        }

        [Fact]
        public void FundEnginePool_TwoHopDeliversMemoRoutedCredit()
        {
            var t = DeployTreasury(withEngine: true);
            var ctx = t.Ctx;

            // App-admin witness only.
            AsAdmin(ctx);
            AssertRevert("unauthorized: not app admin", () => ctx.Registry.fundEnginePool(AppId, GAS_UNIT));

            As(ctx, t.AppAdmin);
            ctx.Registry.fundEnginePool(AppId, 40 * GAS_UNIT);

            // Destination was hard-bound to the app's registered engine and
            // the GAS arrived under the 'appId:credit' memo grammar, payer =
            // the registry (the forwarding hop).
            Assert.Equal(new BigInteger(40 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(ctx.EngineMock.Hash));
            Assert.Equal(new BigInteger(40 * GAS_UNIT), ctx.EngineMock.poolCreditOf(AppId));
            Assert.Equal(AppId + ":credit", ctx.EngineMock.lastPoolMemoOf(AppId));
            Assert.Equal(ctx.Registry.Hash, ctx.EngineMock.lastPoolPayerOf(AppId));

            // The transit hop is fully accounted: nothing stuck registry-side.
            Assert.Equal(new BigInteger(160 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Account));
            Assert.Equal(BigInteger.Zero, ctx.Engine.Native.GAS.BalanceOf(ctx.Registry.Hash) - ctx.Registry.totalCreditLiability());

            // Pause gates: pool funding is not an exit lane.
            ctx.Registry.setAppPaused(AppId, true);
            AssertRevert("app paused", () => ctx.Registry.fundEnginePool(AppId, GAS_UNIT));
            ctx.Registry.setAppPaused(AppId, false);
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(true);
            As(ctx, t.AppAdmin);
            AssertRevert("registry paused", () => ctx.Registry.fundEnginePool(AppId, GAS_UNIT));
        }

        [Fact]
        public void FundEnginePool_RequiresEngineAndAccount()
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform("no-engine-app", "", appAdmin, null);
            As(ctx, appAdmin);
            AssertRevert("no minted account", () => ctx.Registry.fundEnginePool("no-engine-app", GAS_UNIT));
            AsAdmin(ctx);
            ctx.Registry.mintAccount("no-engine-app");
            As(ctx, appAdmin);
            AssertRevert("no engine attached", () => ctx.Registry.fundEnginePool("no-engine-app", GAS_UNIT));
        }

        [Fact]
        public void Exits_ArePauseImmune_SpendToPayoutUnderGlobalPause()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(true);

            // The witness-gated treasury exit survives the global kill
            // switch (anchor invariant) while non-exit lanes freeze.
            As(ctx, t.AppAdmin);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin) ?? 0;
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 3 * GAS_UNIT);
            Assert.Equal(before + 3 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin));
            AssertRevert("registry paused",
                () => ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 5 * GAS_UNIT));
        }

        [Fact]
        public void EscapeHatch_OrderingAgainstTheRealRegistry()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;

            // No global pause: the hatch stays shut.
            As(ctx, t.AppAdmin);
            AssertRevert("registry not globally paused",
                () => t.Shim.escapeExecute(ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Freshly paused: the 30-day window has not elapsed.
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(true);
            As(ctx, t.AppAdmin);
            AssertRevert("escape window not open",
                () => t.Shim.escapeExecute(ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Un-pausing closes the hatch again (no stale clocks).
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(false);
            As(ctx, t.AppAdmin);
            AssertRevert("registry not globally paused",
                () => t.Shim.escapeExecute(ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Paused and 30 days elapsed: the app admin exits the treasury
            // even though the registry is dead — the credible-exit guarantee.
            AsAdmin(ctx);
            ctx.Registry.setGlobalPaused(true);
            AdvanceMs(ctx, ESCAPE_TIMELOCK_MS + 1_000);
            As(ctx, t.AppAdmin);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin) ?? 0;
            t.Shim.escapeExecute(ctx.Engine.Native.GAS.Hash, 7 * GAS_UNIT);
            Assert.Equal(before + 7 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.AppAdmin));
        }

        [Fact]
        public void WithdrawPlatformFees_AdminBoundAndCapped()
        {
            var ctx = Deploy();
            var appAdmin = TestEngine.GetNewSigner().Account;
            FundGas(ctx, appAdmin, 5 * GAS_UNIT);
            DepositCredit(ctx, appAdmin, "fee-app", 2 * GAS_UNIT);
            As(ctx, appAdmin);
            ctx.Registry.registerApp("fee-app", "", appAdmin, null);
            Assert.Equal(new BigInteger(FEE_LITE), ctx.Registry.accruedFees());

            // Only the platform admin, only up to the accrued amount, and the
            // destination is hard-bound to the admin itself.
            AssertRevert("unauthorized", () => ctx.Registry.withdrawPlatformFees(FEE_LITE));
            AsAdmin(ctx);
            AssertRevert("insufficient accrued fees", () => ctx.Registry.withdrawPlatformFees(2 * FEE_LITE));
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(ctx.PlatformAdmin) ?? 0;
            ctx.Registry.withdrawPlatformFees(FEE_LITE);
            Assert.Equal(before + FEE_LITE, ctx.Engine.Native.GAS.BalanceOf(ctx.PlatformAdmin));
            Assert.Equal(BigInteger.Zero, ctx.Registry.accruedFees());

            // Liability conservation held throughout: registry GAS balance ==
            // credit liability + accrued fees.
            Assert.Equal(
                ctx.Registry.totalCreditLiability() + ctx.Registry.accruedFees(),
                ctx.Engine.Native.GAS.BalanceOf(ctx.Registry.Hash));
        }
    }
}
