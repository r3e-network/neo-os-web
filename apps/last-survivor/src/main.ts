/**
 * Last Survivor — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { useTicker } from "@shared/composables/useTicker";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useLastSurvivor } from "./composables/useLastSurvivor";

defineMiniApp({
  appId: "miniapp-last-survivor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const game = useLastSurvivor({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Start the countdown ticker
    const timerTicker = useTicker(() => game.updateNow(), 1000);
    timerTicker.start();

    const { notify } = platformServices;

    // Register actions
    ctx.registerAction("buyKeys", async (keyCount: string) => {
      return await notify.guard(() => game.buyKeys(keyCount), "keysPurchased");
    });

    ctx.registerAction("claimPrize", async () => {
      await notify.guard(() => game.claimPrize(), "prizeClaimed");
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
        timerTicker.stop();
      },
    };
  },
});
