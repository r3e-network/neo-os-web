/**
 * Last Survivor — React Entry Point
 *
 * Drives the standalone on-chain MiniAppLastSurvivor contract through the
 * ctx.framework SDK (app.chain.*). The composable owns all contract
 * reads/writes; this file wires the framework surface, the buy/settle/refresh
 * actions (success toasts via actions.register successKey), and the 1s
 * countdown ticker.
 *
 * Two-mode support: GUEST is a purely local doomsday-clock drill (no token,
 * oracle, chain, or reward ops) driven by ./logic/guest-engine over the SAME
 * observables the scene reads; GAMEFI is the on-chain behavior, unchanged. Every
 * chain-touching action branches on app.mode.isGuest() BEFORE any guarded call,
 * so the framework guest guard never fires.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useLastSurvivor } from "./composables/useLastSurvivor";
import { createGuestEngine } from "./logic/guest-engine";

/** Manifest hiding is not authorization: new paid rounds fail closed here. */
export const NEW_PAID_ROUNDS_ENABLED = false;

defineMiniApp({
  appId: "miniapp-last-survivor",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const game = useLastSurvivor({
      app,
      t: ctx.t,
    });

    game.setAddress(app.chain.address.get() ?? null);

    // Play mode surfaced into the PlayArea so its copy (and the scene's) can drop
    // the GAS-at-stake / reward framing in guest and show a purely local drill.
    // Kept in sync with app.mode via onChange.
    const appMode = createObservable(app.mode.get());
    const gasBalance = app.wallet.observeBalance("GAS");
    const walletBalanceAvailable = createObservable(false);
    const refreshGasBalance = async () => {
      const connected = app.chain.address.get();
      if (!connected) {
        gasBalance.balance.set("0");
        walletBalanceAvailable.set(false);
        return;
      }
      try {
        // observeBalance intentionally keeps its last value when a refresh
        // fails. Read raw here as well so the game can distinguish that stale
        // value from a freshly verified zero before opening a buy flow.
        const raw = await app.wallet.raw("GAS", connected);
        gasBalance.balance.set(app.amount.fixed8ToGas(raw));
        walletBalanceAvailable.set(true);
      } catch {
        walletBalanceAvailable.set(false);
      }
    };
    const isConnectingWallet = createObservable(false);
    const paidActionsAvailable = createObservable(NEW_PAID_ROUNDS_ENABLED);
    const guestScore = createObservable(0);
    const guestLeaderLabel = createObservable(ctx.t("guestNoBuyerYet"));
    const guestOutcome = createObservable<"ready" | "running" | "won" | "lost">("ready");
    const guestRivalCue = createObservable(ctx.t("guestOpeningCue"));
    const guestMoveReady = createObservable(true);
    // Keep the composable identity aligned with host connect/disconnect events.
    // The explicit connect action below also refreshes the balance + round; this
    // hook only mirrors identity (fires solely on an actual account change) and
    // never submits a purchase.
    const stopAddressSync = app.wallet.onAccountChanged(({ current }) => {
      game.setAddress(current);
      void refreshGasBalance();
    });

    // Guest (free / local) engine — drives the SAME observables the scene reads
    // with a local bot-rival last-buyer challenge; zero chain/oracle/reward.
    const guest = createGuestEngine({
      roundId: game.roundId,
      totalPot: game.totalPot,
      isRoundActive: game.isRoundActive,
      lastBuyer: game.lastBuyer,
      userKeys: game.userKeys,
      totalKeysInRound: game.totalKeysInRound,
      endTime: game.endTime,
      timeRemainingSeconds: game.timeRemainingSeconds,
      history: game.history,
      roundDataAvailable: game.roundDataAvailable,
      serviceNotice: game.serviceNotice,
      keyValidationError: game.keyValidationError,
      isBuyingKeys: game.isBuyingKeys,
      isSettling: game.isSettling,
      prepaidCredit: game.prepaidCredit,
      address: game.address,
      guestScore,
      guestLeaderLabel,
      guestOutcome,
      guestRivalCue,
      guestMoveReady,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    // Switching to guest at the launcher resets to a clean local arena and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
      else guest.leave();
    });
    // Robust against a mount that already resolved to guest before we subscribed.
    if (app.mode.isGuest()) void guest.enter();

    // Start the countdown ticker
    const tickerInterval = setInterval(() => game.updateNow(), 1000);

    ctx.framework.actions.register(
      "buyKeys",
      async (keyCount: unknown) => {
        if (app.mode.isGuest()) {
          const loaded = guest.buyKeys(String(keyCount));
          if (!loaded) throw new Error(ctx.t("guestMoveUnavailable"));
          return;
        }
        if (!NEW_PAID_ROUNDS_ENABLED) {
          throw new Error(ctx.t("paidRoundsUnavailable"));
        }
        try {
          const purchased = await game.buyKeys(String(keyCount));
          if (!purchased) throw new Error(ctx.t("keyPurchaseUnavailable"));
          ctx.setStatus(ctx.t("keysPurchased"), "success");
        } finally {
          // A failed second step can leave reusable prepaid credit. Refresh both
          // funding sources so the next pre-flight reflects that recovery path.
          await Promise.allSettled([game.loadCredit(), refreshGasBalance()]);
        }
      },
    );

    ctx.framework.actions.register(
      "settleRound",
      async () => {
        if (app.mode.isGuest()) {
          const settled = await guest.settleRound();
          if (!settled) throw new Error(ctx.t("guestMoveUnavailable"));
          ctx.setStatus(
            ctx.t(settled.outcome === "won" ? "guestScoreBanked" : "guestRunRestarted", {
              score: settled.score,
            }),
            settled.outcome === "won" ? "success" : "info",
          );
          return;
        }
        try {
          await game.settleRound();
          ctx.setStatus(ctx.t("roundSettled"), "success");
        } finally {
          await Promise.allSettled([refreshGasBalance()]);
        }
      },
    );

    ctx.framework.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get()) return;
      // A stale host or deep link may still reach GameFi mode. Connecting is
      // always terminal and non-purchasing so an unknown wallet can discover
      // and withdraw historical credit even while new rounds are disabled.
      isConnectingWallet.set(true);
      try {
        const connected = await app.wallet.ensure();
        game.setAddress(connected || app.chain.address.get() || null);
        // Connect is intentionally terminal: it refreshes identity, wallet
        // funds, credit and round state, but never falls through to buyKeys.
        await Promise.all([refreshGasBalance(), game.loadAll()]);
      } finally {
        isConnectingWallet.set(false);
      }
    });

    ctx.framework.actions.register("refreshRound", async () => {
      if (app.mode.isGuest()) {
        await guest.refresh();
        return;
      }
      await Promise.all([game.loadAll(), refreshGasBalance()]);
    });

    ctx.framework.actions.register("recoverTransaction", async () => {
      if (app.mode.isGuest()) return;
      const recovered = await game.recoverPendingPurchase();
      if (recovered) {
        ctx.setStatus(ctx.t("transactionRecoveryConfirmed"), "success");
        await Promise.all([game.loadAll(), refreshGasBalance()]);
      } else if (!game.purchasePending.get() && game.recoveryNotice.get() === ctx.t("transactionFault")) {
        ctx.setStatus(ctx.t("transactionFault"), "error");
      } else {
        ctx.setStatus(ctx.t("transactionRecoveryStillPending"), "info");
      }
    });

    ctx.framework.actions.register("withdrawCredit", async () => {
      if (app.mode.isGuest()) {
        guest.withdraw();
        return;
      }
      await ctx.framework.notify.guard(async () => {
        const { amount } = await game.withdrawCredit();
        if (amount > 0) {
          ctx.framework.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
        await refreshGasBalance();
      });
    });

    ctx.framework.actions.register("setKeyCount", async (value: unknown) => {
      if (
        game.isBuyingKeys.get() ||
        game.purchasePending.get() ||
        game.isSettling.get() ||
        game.isLoading.get() ||
        isConnectingWallet.get()
      ) return;
      game.keyCount.set(String(value));
      if (!app.mode.isGuest()) await game.loadAuthoritativeQuote(String(value));
    });

    return {
      state: {
        appMode,
        roundId: game.roundId,
        totalPot: game.totalPot,
        isRoundActive: game.isRoundActive,
        lastBuyer: game.lastBuyer,
        userKeys: game.userKeys,
        keyCount: game.keyCount,
        keyValidationError: game.keyValidationError,
        history: game.history,
        isBuyingKeys: game.isBuyingKeys,
        purchasePending: game.purchasePending,
        isSettling: game.isSettling,
        isLoading: game.isLoading,
        isConnectingWallet,
        paidActionsAvailable,
        guestScore,
        guestLeaderLabel,
        guestOutcome,
        guestRivalCue,
        guestMoveReady,
        roundDataAvailable: game.roundDataAvailable,
        userKeysAvailable: game.userKeysAvailable,
        creditAvailable: game.creditAvailable,
        historyAvailable: game.historyAvailable,
        quoteAvailable: game.quoteAvailable,
        serviceNotice: game.serviceNotice,
        prepaidCredit: game.prepaidCredit,
        pendingOperationKind: game.pendingOperationKind,
        pendingTransactionId: game.pendingTransactionId,
        recoveryNotice: game.recoveryNotice,
        storageHealthy: game.storageHealthy,
        countdown: game.countdown,
        timeRemainingSeconds: game.timeRemainingSeconds,
        dangerLevel: game.dangerLevel,
        dangerLevelText: game.dangerLevelText,
        dangerProgress: game.dangerProgress,
        shouldPulse: game.shouldPulse,
        lastBuyerLabel: game.lastBuyerLabel,
        formattedRound: game.formattedRound,
        totalPotDisplay: game.totalPotDisplay,
        roundStatusDisplay: game.roundStatusDisplay,
        userKeysDisplay: game.userKeysDisplay,
        totalKeysDisplay: game.totalKeysDisplay,
        userSharePercent: game.userSharePercent,
        needsLifecycleSync: game.needsLifecycleSync,
        estimatedCost: game.estimatedCost,
        estimatedCostGas: game.estimatedCostGas,
        viewerAddress: game.address,
        walletGasBalance: gasBalance.balance,
        walletBalanceAvailable,
      },
      loadData: async () => {
        if (app.mode.isGuest()) return;
        await Promise.all([game.loadAll(), refreshGasBalance()]);
      },
      cleanup: () => {
        clearInterval(tickerInterval);
        stopAddressSync();
        stopModeSync();
        guest.cleanup();
      },
    };
  },
});
