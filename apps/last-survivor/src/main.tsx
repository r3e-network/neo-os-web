/**
 * Last Survivor — React Entry Point
 *
 * Drives the standalone on-chain MiniAppLastSurvivor contract directly via
 * ctx.services.chain (no OS service proxies). The composable owns all contract
 * reads/writes; this file wires the chain service, the buy/settle/refresh
 * actions, and the 1s countdown ticker.
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
      chain: ctx.services.chain,
      t: ctx.t,
    });

    game.setAddress(ctx.services.chain.address.get() ?? null);

    // Start the countdown ticker
    const tickerInterval = setInterval(() => game.updateNow(), 1000);

    ctx.registerAction("buyKeys", async (keyCount: unknown) => {
      await ctx.services.notify.guard(
        () => game.buyKeys(String(keyCount)),
        "keysPurchased",
      );
    });

    ctx.registerAction("settleRound", async () => {
      await ctx.services.notify.guard(
        () => game.settleRound(),
        "roundSettled",
      );
    });

    ctx.registerAction("refreshRound", async () => {
      await game.loadAll();
    });

    ctx.registerAction("setKeyCount", async (value: unknown) => {
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
      },
      loadData: game.loadAll,
      cleanup: () => {
        clearInterval(tickerInterval);
      },
    };
  },
});
