/**
 * Last Survivor — React Entry Point
 *
 * Drives the standalone on-chain MiniAppLastSurvivor contract through the
 * ctx.framework SDK (app.chain.*). The composable owns all contract
 * reads/writes; this file wires the framework surface, the buy/settle/refresh
 * actions (success toasts via actions.register successKey), and the 1s
 * countdown ticker.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useLastSurvivor } from "./composables/useLastSurvivor";

defineMiniApp({
  appId: "miniapp-last-survivor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const game = useLastSurvivor({
      app: ctx.framework,
      t: ctx.t,
    });

    game.setAddress(ctx.framework.chain.address.get() ?? null);

    // Start the countdown ticker
    const tickerInterval = setInterval(() => game.updateNow(), 1000);

    ctx.framework.actions.register(
      "buyKeys",
      async (keyCount: unknown) => {
        await game.buyKeys(String(keyCount));
      },
      { successKey: "keysPurchased" },
    );

    ctx.framework.actions.register(
      "settleRound",
      async () => {
        await game.settleRound();
      },
      { successKey: "roundSettled" },
    );

    ctx.framework.actions.register("refreshRound", async () => {
      await game.loadAll();
    });

    ctx.framework.actions.register("withdrawCredit", async () => {
      await ctx.services.notify.guard(async () => {
        const { amount } = await game.withdrawCredit();
        if (amount > 0) {
          ctx.services.notify.success("creditWithdrawn", {
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
