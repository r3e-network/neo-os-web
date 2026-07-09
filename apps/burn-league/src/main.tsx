/**
 * Burn League — React Entry Point
 *
 * Drives the standalone on-chain MiniAppBurnLeague contract directly via
 * ctx.framework.chain (no OS service proxies). The composable owns all contract
 * reads/writes; this file wires the chain service, the burn/settle/refresh
 * actions, and the 1s season-countdown ticker.
 */

import { createObservable, defineMiniApp } from "@shared/react";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBurnLeague } from "./composables/useBurnLeague";
import { createGuestEngine } from "./logic/guest-engine";

function normalizeLaunchAmount(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s*GAS$/i, "");
  if (!raw) return "";

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const boundedAmount = Math.max(1, Math.min(amount, 1_000));
  return Number(boundedAmount.toFixed(8)).toString();
}

defineMiniApp({
  appId: "miniapp-burn-league",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // getAddress omitted: the composable defaults to app.chain.address.get(),
    // which is the same observable passthrough.
    const burn = useBurnLeague({
      app,
      t: ctx.t,
    });

    burn.setAddress(app.chain.address.get() ?? null);

    // ── Play mode (guest | gamefi) mirrored into an observable for the PlayArea ─
    // The PlayArea + scene read this to switch to local (guest) framing and hide
    // the GAS-at-stake / pool / reward / season copy. Kept in sync with app.mode.
    const appMode = createObservable<string>(app.mode.get());
    // Guest-only streak counter surfaced to the PlayArea/scene (new bridge key).
    const guestStreak = createObservable(0);

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local burn-streak simulation — no chain/oracle/reward
    // calls, so the framework guest guard never fires.
    const guest = createGuestEngine({
      rewardPool: burn.rewardPool,
      totalBurned: burn.totalBurned,
      userBurned: burn.userBurned,
      rank: burn.rank,
      burnCount: burn.burnCount,
      leaderboard: burn.leaderboard,
      isBurning: burn.isBurning,
      isSettling: burn.isSettling,
      seasonId: burn.seasonId,
      seasonEndMs: burn.seasonEndMs,
      topBurnerAddress: burn.topBurnerAddress,
      topBurnedGas: burn.topBurnedGas,
      prepaidCredit: burn.prepaidCredit,
      actionNotice: burn.actionNotice,
      serviceNotice: burn.serviceNotice,
      burnValidationError: burn.burnValidationError,
      lastSettleResult: burn.lastSettleResult,
      burnAmount: burn.burnAmount,
      minBurnGas: burn.minBurnGas,
      maxBurnGas: burn.maxBurnGas,
      guestStreak,
      address: burn.address,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

    // Tick the season countdown / phase derivation once per second.
    const tickerInterval = setInterval(() => burn.updateNow(), 1000);

    const launchAmount = normalizeLaunchAmount(
      ctx.launchContext.params.amount ??
        ctx.launchContext.params.burnAmount ??
        ctx.launchContext.params.stake,
    );
    if (launchAmount) burn.burnAmount.set(launchAmount);

    // Guest branches FIRST on every action (lazy isGuest() read at dispatch time,
    // never captured) so a guest stoke stays a purely local call. The gamefi
    // path is unchanged; its burnSuccess toast is emitted directly so the guest
    // branch can stay toast-free (a GAS "season total" toast would leak the
    // reward framing that guest must hide).
    app.actions.register("burn", async (amount: unknown) => {
      if (app.mode.isGuest()) {
        guest.stoke(amount);
        return;
      }
      try {
        await burn.burnTokens(String(amount));
        app.notify.success("burnSuccess");
      } catch (error) {
        app.notify.error(error);
      }
    });

    app.actions.register(
      "settle",
      async () => {
        // Guest never has an on-chain season to settle (needsSettle is always
        // false, so the settle affordance is hidden) — branch before the write.
        if (app.mode.isGuest()) return;
        await burn.settleSeason();
      },
      { successKey: "settleSuccess" },
    );

    app.actions.register("withdrawCredit", async () => {
      // Guest carries no prepaid credit (the affordance is hidden) — no chain op.
      if (app.mode.isGuest()) return;
      await app.notify.guard(async () => {
        const { amount } = await burn.withdrawCredit();
        if (amount > 0) {
          app.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    // setBurnAmount is pure local UI state in both modes (no chain/oracle/reward
    // call), so it needs no guest branch — the guest engine reads burnAmount.
    app.actions.register("setBurnAmount", async (amount: unknown) => {
      if (typeof amount === "string") burn.burnAmount.set(amount);
    });

    return {
      state: {
        totalBurned: burn.totalBurned,
        userBurned: burn.userBurned,
        rewardPool: burn.rewardPool,
        rank: burn.rank,
        burnCount: burn.burnCount,
        leaderboard: burn.leaderboard,
        burnAmount: burn.burnAmount,
        minBurnGas: burn.minBurnGas,
        maxBurnGas: burn.maxBurnGas,
        isBurning: burn.isBurning,
        isSettling: burn.isSettling,
        isLoading: burn.isLoading,
        leagueDataAvailable: burn.leagueDataAvailable,
        serviceNotice: burn.serviceNotice,
        actionNotice: burn.actionNotice,
        burnValidationError: burn.burnValidationError,
        lastSubmittedAmount: burn.lastSubmittedAmount,
        prepaidCredit: burn.prepaidCredit,
        prepaidCreditDisplay: burn.prepaidCreditDisplay,
        totalBurnedDisplay: burn.totalBurnedDisplay,
        userBurnedDisplay: burn.userBurnedDisplay,
        rewardPoolDisplay: burn.rewardPoolDisplay,
        formattedRank: burn.formattedRank,
        leaderboardSize: burn.leaderboardSize,
        projectedTotalBurnedDisplay: burn.projectedTotalBurnedDisplay,
        leaderboardPreview: burn.leaderboardPreview,
        // Season lifecycle + real prize model
        seasonPhase: burn.seasonPhase,
        isSeasonActive: burn.isSeasonActive,
        needsSettle: burn.needsSettle,
        countdown: burn.countdown,
        seasonStatusLabel: burn.seasonStatusLabel,
        formattedSeason: burn.formattedSeason,
        seasonDurationLabel: burn.seasonDurationLabel,
        prizePoolDisplay: burn.prizePoolDisplay,
        topBurnedDisplay: burn.topBurnedDisplay,
        leaderLabel: burn.leaderLabel,
        userIsLeader: burn.userIsLeader,
        lastSettleResult: burn.lastSettleResult,
        // Two-mode surface — read by the PlayArea + scene to switch framing.
        appMode,
        guestStreak,
      },
      // The mount-time load runs under the default gamefi mode (chain reads are
      // allowed; the guard never fires). Once the player has switched to guest,
      // gate the whole loader so a re-load never clobbers the local surface —
      // guest data comes from guest.enter() instead.
      loadData: async () => {
        if (app.mode.isGuest()) return;
        await burn.loadAll();
      },
      cleanup: () => {
        clearInterval(tickerInterval);
        guest.dispose();
      },
    };
  },
});
