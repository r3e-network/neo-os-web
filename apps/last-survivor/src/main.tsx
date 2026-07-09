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

    // Guest (free / local) engine — drives the SAME observables the scene reads
    // with a local single-player last-buyer challenge; zero chain/oracle/reward.
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
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    // Switching to guest at the launcher resets to a clean local arena and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });
    // Robust against a mount that already resolved to guest before we subscribed.
    if (app.mode.isGuest()) void guest.enter();

    // Start the countdown ticker
    const tickerInterval = setInterval(() => game.updateNow(), 1000);

    ctx.framework.actions.register(
      "buyKeys",
      async (keyCount: unknown) => {
        if (app.mode.isGuest()) {
          guest.buyKeys(String(keyCount));
          return;
        }
        await game.buyKeys(String(keyCount));
      },
      { successKey: "keysPurchased" },
    );

    ctx.framework.actions.register(
      "settleRound",
      async () => {
        if (app.mode.isGuest()) {
          await guest.settleRound();
          return;
        }
        await game.settleRound();
      },
      { successKey: "roundSettled" },
    );

    ctx.framework.actions.register("refreshRound", async () => {
      if (app.mode.isGuest()) {
        await guest.refresh();
        return;
      }
      await game.loadAll();
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
      });
    });

    ctx.framework.actions.register("setKeyCount", async (value: unknown) => {
      game.keyCount.set(String(value));
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
        isSettling: game.isSettling,
        isLoading: game.isLoading,
        roundDataAvailable: game.roundDataAvailable,
        serviceNotice: game.serviceNotice,
        prepaidCredit: game.prepaidCredit,
        countdown: game.countdown,
        dangerLevel: game.dangerLevel,
        dangerLevelText: game.dangerLevelText,
        dangerProgress: game.dangerProgress,
        shouldPulse: game.shouldPulse,
        lastBuyerLabel: game.lastBuyerLabel,
        formattedRound: game.formattedRound,
        totalPotDisplay: game.totalPotDisplay,
        roundStatusDisplay: game.roundStatusDisplay,
        totalKeysDisplay: game.totalKeysDisplay,
        userSharePercent: game.userSharePercent,
        needsLifecycleSync: game.needsLifecycleSync,
        estimatedCost: game.estimatedCost,
        viewerAddress: game.address,
      },
      loadData: game.loadAll,
      cleanup: () => {
        clearInterval(tickerInterval);
      },
    };
  },
});
