/**
 * Burn League — React Entry Point
 *
 * Drives the standalone on-chain MiniAppBurnLeague contract directly via
 * ctx.framework.chain (no OS service proxies). The composable owns all contract
 * reads/writes; this file wires the chain service, the burn/settle/refresh
 * actions, and the 1s season-countdown ticker.
 */

import { createObservable, defineMiniApp } from "@shared/react";
import { createDerived } from "@shared/react/context";
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
    const gasBalance = app.wallet.observeBalance("GAS");
    const walletConnected = createDerived(
      () => app.wallet.isConnected(),
      [app.chain.address],
    );
    const isConnectingWallet = createObservable(false);
    const burnConfirmArmed = createObservable(false);
    const burnConfirmAmount = createObservable("");
    const BURN_CONFIRM_WINDOW_MS = 12_000;
    let burnConfirmExpiresAt = 0;
    let burnConfirmTimer: ReturnType<typeof setTimeout> | null = null;

    const disarmBurnConfirmation = () => {
      burnConfirmArmed.set(false);
      burnConfirmAmount.set("");
      burnConfirmExpiresAt = 0;
      if (burnConfirmTimer) clearTimeout(burnConfirmTimer);
      burnConfirmTimer = null;
    };

    const armBurnConfirmation = (amount: string) => {
      disarmBurnConfirmation();
      burnConfirmArmed.set(true);
      burnConfirmAmount.set(amount);
      burnConfirmExpiresAt = Date.now() + BURN_CONFIRM_WINDOW_MS;
      burn.actionNotice.set(ctx.t("burnConfirmPrompt", { amount }));
      burnConfirmTimer = setTimeout(() => {
        if (!burnConfirmArmed.get()) return;
        disarmBurnConfirmation();
        burn.actionNotice.set(ctx.t("burnConfirmExpired"));
      }, BURN_CONFIRM_WINDOW_MS);
    };

    // RFC P0-5: identity-diff account hook — fires only when the normalized
    // wallet address actually changes (extension account switch / disconnect);
    // handler errors are isolated by the framework.
    const addressUnsubscribe = app.wallet.onAccountChanged(() => {
      disarmBurnConfirmation();
      const nextAddress = app.chain.address.get() ?? null;
      burn.setAddress(nextAddress);
      // A wallet-extension account switch can happen outside our connect action.
      // Reconcile user totals, credit, balance, and that account's pending tx.
      if (nextAddress && !app.mode.isGuest() && !isConnectingWallet.get()) {
        void Promise.all([burn.loadAll(), gasBalance.refresh()])
          .then(() => burn.restorePendingBurn())
          .catch((error) => {
            console.warn("[burn-league] wallet account refresh failed", error);
          });
      }
    });

    // ── Play mode (guest | gamefi) mirrored into an observable for the PlayArea ─
    // The PlayArea + scene read this to switch to local (guest) framing and hide
    // the GAS-at-stake / pool / reward / season copy. Kept in sync with app.mode.
    const appMode = createObservable<string>(app.mode.get());
    // Guest-only streak counter surfaced to the PlayArea/scene (new bridge key).
    const guestStreak = createObservable(0);
    // Vite's standalone dev server has no OS edge-function proxy. Keep the
    // free-play lane genuinely local there instead of producing a noisy 404;
    // hosted builds retain the best-effort namespaced guest leaderboard.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> {
            return;
          },
          async get(): Promise<Array<{ user: string; score: string }>> {
            return [];
          },
        }
      : app.mode.guestLeaderboard;

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
      guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      disarmBurnConfirmation();
      if (mode === "guest") {
        void guest.enter();
        return;
      }

      // Cancel a local stoke before restoring canonical GameFi state; otherwise
      // its delayed result could overwrite fresh contract reads after a mode
      // switch. This is reconciliation only and never submits a transaction.
      guest.dispose();
      guestStreak.set(0);
      void Promise.all([burn.loadAll(), gasBalance.refresh()])
        .then(() => burn.restorePendingBurn())
        .catch((error) => {
          console.warn("[burn-league] mode-change refresh failed", error);
        });
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
    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get()) return;
      isConnectingWallet.set(true);
      disarmBurnConfirmation();
      try {
        const connectedAddress = await app.wallet.ensure();
        if (!connectedAddress) throw new Error(ctx.t("burnWalletUnavailable"));
        burn.setAddress(connectedAddress);
        await Promise.all([burn.loadAll(), gasBalance.refresh()]);
        const recovery = await burn.restorePendingBurn();
        if (recovery.status === "none") {
          burn.actionNotice.set(ctx.t("burnWalletConnected"));
        }
      } catch (error) {
        app.notify.error(error);
      } finally {
        isConnectingWallet.set(false);
      }
    });

    app.actions.register("burn", async (amount: unknown) => {
      if (app.mode.isGuest()) {
        guest.stoke(amount);
        return;
      }

      // Connecting and irreversibly spending GAS are deliberately separate
      // gestures. A disconnected primary press ONLY offers connectWallet.
      if (!app.wallet.isConnected() || !app.chain.address.get()) {
        disarmBurnConfirmation();
        burn.actionNotice.set(ctx.t("burnConnectFirst"));
        app.notify.info("burnConnectFirst");
        return;
      }
      if (burn.hasUnknownBurn.get()) {
        disarmBurnConfirmation();
        burn.actionNotice.set(ctx.t("burnPendingBlocksNew"));
        app.notify.info("burnPendingBlocksNew");
        return;
      }

      const amountString = String(amount ?? burn.burnAmount.get()).trim();
      burn.burnAmount.set(amountString);
      const validation = burn.validateBurnAmount(amountString);
      if (validation) {
        disarmBurnConfirmation();
        burn.burnValidationError.set(validation);
        app.notify.error(new Error(validation));
        return;
      }
      burn.burnValidationError.set(null);

      const confirmationIsCurrent =
        burnConfirmArmed.get() &&
        burnConfirmAmount.get() === amountString &&
        Date.now() <= burnConfirmExpiresAt;
      if (!confirmationIsCurrent) {
        await gasBalance.refresh();
        armBurnConfirmation(amountString);
        return;
      }

      disarmBurnConfirmation();
      try {
        const result = await burn.burnTokens(amountString);
        if (result.status === "confirmed") {
          app.notify.success("burnSuccess");
          await gasBalance.refresh();
        } else {
          app.notify.info(
            result.phase === "deposit"
              ? "burnDepositUnknown"
              : "burnTransactionUnknown",
          );
        }
      } catch (error) {
        app.notify.error(error);
      }
    });

    app.actions.register("settle", async () => {
      // Guest never has an on-chain season to settle (needsSettle is always
      // false, so the settle affordance is hidden) — branch before the write.
      if (app.mode.isGuest()) return;
      if (!app.wallet.isConnected()) {
        burn.actionNotice.set(ctx.t("burnConnectFirst"));
        return;
      }
      try {
        const result = await burn.settleSeason();
        if (result.status === "confirmed") app.notify.success("settleSuccess");
        else app.notify.info("settleTransactionUnknown");
      } catch (error) {
        app.notify.error(error);
      }
    });

    app.actions.register("recheckBurn", async () => {
      if (app.mode.isGuest()) return;
      const result = await burn.recheckPendingBurn();
      if (result.status === "burn-confirmed") {
        app.notify.success("burnSuccess");
        await gasBalance.refresh();
      } else if (result.status === "deposit-confirmed") {
        app.notify.info("burnDepositReady");
        await gasBalance.refresh();
      } else if (result.status === "pending") {
        app.notify.info(
          result.operation?.phase === "deposit"
            ? "burnDepositUnknown"
            : "burnTransactionUnknown",
        );
      }
    });

    app.actions.register("withdrawCredit", async () => {
      // Guest carries no prepaid credit (the affordance is hidden) — no chain op.
      if (app.mode.isGuest()) return;
      await app.notify.guard(async () => {
        const { amount, status } = await burn.withdrawCredit();
        if (status === "unknown") {
          app.notify.info("withdrawTransactionUnknown");
        } else if (amount > 0) {
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
      if (typeof amount === "string") {
        if (amount !== burn.burnAmount.get()) disarmBurnConfirmation();
        burn.burnAmount.set(amount);
      }
    });

    app.actions.register("bankGuestRun", async () => {
      if (!app.mode.isGuest()) return;
      guest.bank();
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
        walletConnected,
        walletGasBalance: gasBalance.balance,
        isConnectingWallet,
        burnConfirmArmed,
        burnConfirmAmount,
        burnTransactionState: burn.burnTransactionState,
        pendingBurnTxid: burn.pendingBurnTxid,
        pendingBurnPhase: burn.pendingBurnPhase,
        hasUnknownBurn: burn.hasUnknownBurn,
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
        await Promise.all([burn.loadAll(), gasBalance.refresh()]);
        await burn.restorePendingBurn();
      },
      cleanup: () => {
        clearInterval(tickerInterval);
        disarmBurnConfirmation();
        addressUnsubscribe();
        guest.dispose();
      },
    };
  },
});
