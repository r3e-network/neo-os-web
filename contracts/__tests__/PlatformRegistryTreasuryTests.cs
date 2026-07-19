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
            public UInt160 Payout = null!;
            public UInt160 Account = null!;
            public AppAccountContract Shim = null!;
        }

        // Registered + minted app whose account holds 200 GAS. Per finding 1
        // the registry no longer auto-seeds a payout address; unless setPayout
        // is false the helper installs an explicit, distinct one through the
        // 24h timelocked setter so the spend lanes become usable.
        private static TreasuryCtx DeployTreasury(bool withEngine = false, bool setPayout = true)
        {
            var ctx = Deploy();
            SetArtifact(ctx);
            if (withEngine) RegisterEngine(ctx, EngineId, ctx.EngineMock.Hash);
            var appAdmin = TestEngine.GetNewSigner().Account;
            var payout = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform(AppId, withEngine ? EngineId : "", appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount(AppId)!;
            FundGas(ctx, account, 200 * GAS_UNIT);
            var t = new TreasuryCtx
            {
                Ctx = ctx,
                AppAdmin = appAdmin,
                Payout = payout,
                Account = account,
                Shim = ctx.Engine.FromHash<AppAccountContract>(account, false),
            };
            if (setPayout) InstallPayout(t, payout);
            return t;
        }

        // The finding-1 default hardening: a spend destination must be set
        // explicitly through the timelocked payout setter before any spend
        // lane works.
        private static void InstallPayout(TreasuryCtx t, UInt160 payout)
        {
            As(t.Ctx, t.AppAdmin);
            t.Ctx.Registry.proposePayoutAddress(AppId, payout);
            AdvanceMs(t.Ctx, TIMELOCK_MS + 1_000);
            t.Ctx.Registry.executePayoutAddress(AppId);
        }

        [Fact]
        public void SpendToPayout_RoleBoundLane_StrangerFaults()
        {
            var t = DeployTreasury();
            var ctx = t.Ctx;

            // The payout destination is the explicitly installed address.
            Assert.Equal(t.Payout, ctx.Registry.payoutAddressOf(AppId));

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
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.Payout) ?? 0;
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 5 * GAS_UNIT);
            Assert.Equal(before + 5 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.Payout));
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

            // Default threshold is 100 GAS; the cumulative window budget
            // rejects an instant spend above it.
            Assert.Equal(new BigInteger(100 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));
            AssertRevert("window spend budget exceeded",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 101 * GAS_UNIT));

            // The timelocked lane: propose -> wait 24h -> execute. It is the
            // above-threshold single-spend path and bypasses the window.
            AssertRevert("no pending spend", () => ctx.Registry.executeSpend(AppId));
            ctx.Registry.proposeSpend(AppId, ctx.Engine.Native.GAS.Hash, 150 * GAS_UNIT);
            AssertRevert("timelock active", () => ctx.Registry.executeSpend(AppId));
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);

            // Execute stays witness-gated to the app admin.
            var stranger = TestEngine.GetNewSigner().Account;
            As(ctx, stranger);
            AssertRevert("unauthorized: not app admin", () => ctx.Registry.executeSpend(AppId));
            As(ctx, t.AppAdmin);
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.Payout) ?? 0;
            ctx.Registry.executeSpend(AppId);
            Assert.Equal(before + 150 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.Payout));

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
            var t = DeployTreasury(setPayout: false);
            var ctx = t.Ctx;
            var newPayout = TestEngine.GetNewSigner().Account;

            // No auto-seeded payout: the spend lane is unusable until one is
            // installed through the timelock (finding 1 default hardening).
            Assert.Equal(UInt160.Zero, ctx.Registry.payoutAddressOf(AppId));
            As(ctx, t.AppAdmin);
            AssertRevert("no payout address",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            AssertRevert("payout cannot be the registry",
                () => ctx.Registry.proposePayoutAddress(AppId, ctx.Registry.Hash));
            ctx.Registry.proposePayoutAddress(AppId, newPayout);
            AssertRevert("timelock active", () => ctx.Registry.executePayoutAddress(AppId));

            // A compromised key cannot instantly redirect: no payout is live
            // until the 24h lock matures.
            Assert.Equal(UInt160.Zero, ctx.Registry.payoutAddressOf(AppId));
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
            AssertRevert("window spend budget exceeded",
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
            // the GAS arrived under the 'appId:fund' memo grammar, payer =
            // the registry (the forwarding hop).
            Assert.Equal(new BigInteger(40 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(ctx.EngineMock.Hash));
            Assert.Equal(new BigInteger(40 * GAS_UNIT), ctx.EngineMock.poolCreditOf(AppId));
            Assert.Equal(AppId + ":fund", ctx.EngineMock.lastPoolMemoOf(AppId));
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
        public void FundEnginePool_RealRewardGameEngine_PoolCredited()
        {
            // Cross-contract integration (audit H1): the registry's two-hop
            // pool funding must speak the REAL PlatformGame deposit grammar
            // ("appId:fund" tops up the pool). The EngineMockFixture mirrored
            // a wrong 'appId:credit' grammar, which let the memo mismatch
            // pass per-contract suites while the real pair was incompatible:
            // against the deployed engine the same call FAULTs with
            // "invalid payment memo" and the GAS never moves.
            var ctx = Deploy();
            SetArtifact(ctx);

            var (nef, manifest) = Load("PlatformGame");
            AsAdmin(ctx);
            var game = ctx.Engine.Deploy<PlatformGameRewardGameContract>(nef, manifest);
            var oracle = GameOracleMockFixture.Deploy(ctx.Engine, ctx.Engine.ValidatorsAddress);
            game.setOracle(oracle.Hash);
            game.setRegistry(ctx.Registry.Hash);

            const string engineId = "platform-game";
            RegisterEngine(ctx, engineId, game.Hash);

            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform(AppId, engineId, appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount(AppId)!;
            FundGas(ctx, account, 200 * GAS_UNIT);

            As(ctx, appAdmin);
            ctx.Registry.fundEnginePool(AppId, 40 * GAS_UNIT);

            // The 40 GAS landed in the app's reward pool on the real engine;
            // the transit hop left nothing registry-side beyond liabilities.
            Assert.Equal(new BigInteger(40 * GAS_UNIT), game.poolBalance(AppId));
            Assert.Equal(new BigInteger(40 * GAS_UNIT), game.heldForApp(AppId));
            Assert.Equal(new BigInteger(160 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(account));
        }

        [Fact]
        public void SetAppPaused_PushesIntoMintedShim()
        {
            // Pause-push wiring (audit medium): the registry pause flag must
            // reach the minted AppAccount shim so its registry-relayed spend
            // lane freezes — the shim's registry-caller pause branch was
            // unwired dead capability before this push existed.
            var t = DeployTreasury();
            var ctx = t.Ctx;

            Assert.False(t.Shim.isPaused());

            As(ctx, t.AppAdmin);
            ctx.Registry.setAppPaused(AppId, true);
            Assert.True(ctx.Registry.isPaused(AppId));
            Assert.True(t.Shim.isPaused());

            ctx.Registry.setAppPaused(AppId, false);
            Assert.False(ctx.Registry.isPaused(AppId));
            Assert.False(t.Shim.isPaused());
        }

        [Fact]
        public void SpendThresholdRaise_IsTimelocked_TighteningStaysInstant()
        {
            // Audit medium: threshold RAISES widen the cumulative
            // instant-spend bound, so they ride the 24h timelock; tightenings
            // stay instant and supersede any pending raise.
            var t = DeployTreasury();
            var ctx = t.Ctx;

            As(ctx, t.AppAdmin);
            Assert.Equal(new BigInteger(100 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));

            // Tightening: instant.
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 5 * GAS_UNIT);
            Assert.Equal(new BigInteger(5 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));

            // Raise: schedules, does not apply; range still enforced at propose time.
            AssertRevert("spend threshold out of range",
                () => ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 20_000 * GAS_UNIT));
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 500 * GAS_UNIT);
            Assert.Equal(new BigInteger(5 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));
            AssertRevert("timelock active", () => ctx.Registry.executeSpendThresholdRaise(AppId));

            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            ctx.Registry.executeSpendThresholdRaise(AppId);
            Assert.Equal(new BigInteger(500 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));

            // Cancel clears a scheduled raise.
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 600 * GAS_UNIT);
            ctx.Registry.cancelSpendThresholdRaise(AppId);
            AssertRevert("no pending threshold raise", () => ctx.Registry.executeSpendThresholdRaise(AppId));

            // A tightening supersedes a pending raise.
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 600 * GAS_UNIT);
            ctx.Registry.setDescriptor(AppId, "registry:spendThreshold", 400 * GAS_UNIT);
            Assert.Equal(new BigInteger(400 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));
            AssertRevert("no pending threshold raise", () => ctx.Registry.executeSpendThresholdRaise(AppId));
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
            BigInteger before = ctx.Engine.Native.GAS.BalanceOf(t.Payout) ?? 0;
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 3 * GAS_UNIT);
            Assert.Equal(before + 3 * GAS_UNIT, ctx.Engine.Native.GAS.BalanceOf(t.Payout));
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
        public void SpendToPayout_CumulativeWindowBudget_BlocksDrainThenResets()
        {
            // EXPLOIT (finding 1): the instant spendToPayout lane was bounded
            // per CALL, not cumulatively. A compromised app-admin key issues
            // many sub-threshold spends in the same window and drains the
            // treasury far past the threshold. The fix is a rolling 24h window
            // budget: spentInWindow + amount <= threshold.
            var t = DeployTreasury();
            var ctx = t.Ctx;
            As(ctx, t.AppAdmin);

            // Threshold defaults to 100 GAS; each 40 GAS spend is sub-threshold.
            Assert.Equal(new BigInteger(100 * GAS_UNIT), ctx.Registry.spendThresholdOf(AppId));
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 40 * GAS_UNIT);
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 40 * GAS_UNIT);

            // 80 GAS already left this window; a third 40 GAS spend would push
            // the cumulative outflow to 120 GAS > 100 GAS threshold. Pre-fix it
            // succeeds (the drain); post-fix it faults.
            AssertRevert("window spend budget exceeded",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 40 * GAS_UNIT));

            // Exactly the window budget moved, no more.
            Assert.Equal(new BigInteger(80 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Payout));
            Assert.Equal(new BigInteger(80 * GAS_UNIT), ctx.Registry.spentInWindow(AppId));

            // A fresh 24h window reopens the budget.
            AdvanceMs(ctx, TIMELOCK_MS + 1_000);
            Assert.Equal(BigInteger.Zero, ctx.Registry.spentInWindow(AppId));
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, 40 * GAS_UNIT);
            Assert.Equal(new BigInteger(120 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Payout));
        }

        [Fact]
        public void SpendToPayout_RequiresExplicitPayout_NoAutoSeededDefault()
        {
            // EXPLOIT (finding 1 default hardening): registration auto-seeded
            // the payout address to the app admin, so a compromised app-admin
            // key could instantly spend the treasury to itself. The fix drops
            // the auto-seed; a payout must be installed through the 24h
            // timelocked setter first.
            var t = DeployTreasury(setPayout: false);
            var ctx = t.Ctx;

            Assert.Equal(UInt160.Zero, ctx.Registry.payoutAddressOf(AppId));
            As(ctx, t.AppAdmin);
            AssertRevert("no payout address",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Installed through the timelock, the lane works.
            InstallPayout(t, t.Payout);
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT);
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Payout));
        }

        [Fact]
        public void FundEnginePool_TransitLock_HeldAcrossEngineForward()
        {
            // EXPLOIT (finding 3): the transit note (the in-flight reentrancy
            // lock) was cleared inside OnNEP17Payment, BEFORE the registry
            // forwards the pool credit to the engine. During that forward the
            // lock is DOWN, so a hostile engine callback can reenter
            // fundEnginePool and pull a second amount out of the treasury. The
            // fix holds the lock across the forward.
            //
            // A genuine reentrant fundEnginePool aborts inside a native-transfer
            // callback, which hangs the TestEngine host (the documented money-
            // contract idiom). So the hostile engine instead OBSERVES the lock
            // state while it receives the forward: lock-down (1) means the
            // reentry window is open, lock-held (2) means a reentrant call would
            // trip the "treasury hop in progress" guard.
            var ctx = Deploy();
            SetArtifact(ctx);

            var (rNef, rManifest) = Load("ReentrantEngineMockFixture");
            var probe = ctx.Engine.Deploy<ReentrantEngineMockContract>(rNef, rManifest);
            RegisterEngine(ctx, "probe-engine", probe.Hash);

            var appAdmin = TestEngine.GetNewSigner().Account;
            AsAdmin(ctx);
            ctx.Registry.registerAppByPlatform(AppId, "probe-engine", appAdmin, null);
            UInt160 account = ctx.Registry.mintAccount(AppId)!;
            FundGas(ctx, account, 100 * GAS_UNIT);

            probe.arm(ctx.Registry.Hash);
            As(ctx, appAdmin);
            ctx.Registry.fundEnginePool(AppId, 10 * GAS_UNIT);

            // The engine saw the lock HELD while it received the forwarded
            // credit, so a reentrant fundEnginePool would have faulted. Pre-fix
            // it saw the lock already released (1).
            Assert.Equal(new BigInteger(2), probe.observedHopInProgress());

            // Only the intended amount left the treasury; the lock is released
            // once the honest forward lands.
            Assert.Equal(new BigInteger(90 * GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(account));
            Assert.Equal(new BigInteger(10 * GAS_UNIT), probe.poolReceived());
            Assert.False(ctx.Registry.transitHopInProgress() == true);
        }

        [Fact]
        public void SpendToPayout_RespectsLocalAccountPause()
        {
            // Finding 5: spendToPayout is immune to the GLOBAL/registry kill
            // switch (see Exits_ArePauseImmune_...), but it deliberately
            // respects the app admin's LOCAL account pause — a paused account
            // choosing not to spend. escapeExecute stays the true immune exit.
            var t = DeployTreasury();
            var ctx = t.Ctx;

            // The app admin freezes the account's own spend lane.
            As(ctx, t.AppAdmin);
            t.Shim.setPaused(true);
            Assert.True(t.Shim.isPaused() == true);
            AssertRevert("account paused",
                () => ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT));

            // Unpausing restores the lane.
            t.Shim.setPaused(false);
            ctx.Registry.spendToPayout(AppId, ctx.Engine.Native.GAS.Hash, GAS_UNIT);
            Assert.Equal(new BigInteger(GAS_UNIT), ctx.Engine.Native.GAS.BalanceOf(t.Payout));
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
