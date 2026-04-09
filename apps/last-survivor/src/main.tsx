/**
 * Last Survivor — React Entry Point
 *
 * Uses the React defineMiniApp runtime with OS service proxies.
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
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      leaderboardService: ctx.os.leaderboard,
      badgeService: ctx.os.badge,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    // Start the countdown ticker
    const tickerInterval = setInterval(() => game.updateNow(), 1000);

    ctx.registerAction("buyKeys", async (keyCount: unknown) => {
      await ctx.services.notify.guard(
        () => game.buyKeys(String(keyCount)),
        "keysPurchased",
      );
    });

    ctx.registerAction("claimPrize", async () => {
      await ctx.services.notify.guard(() => game.claimPrize(), "prizeClaimed");
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
        isClaiming: game.isClaiming,
        isLoading: game.isLoading,
        countdown: game.countdown,
        dangerLevel: game.dangerLevel,
        dangerLevelText: game.dangerLevelText,
        dangerProgress: game.dangerProgress,
        shouldPulse: game.shouldPulse,
        lastBuyerLabel: game.lastBuyerLabel,
        formattedRound: game.formattedRound,
        totalPotDisplay: game.totalPotDisplay,
        roundStatusDisplay: game.roundStatusDisplay,
        canClaim: game.canClaim,
        estimatedCost: game.estimatedCost,
      },
      loadData: game.loadAll,
      cleanup: () => {
        clearInterval(tickerInterval);
      },
    };
  },
});
