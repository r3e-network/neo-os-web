/**
 * Last Survivor — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-last-survivor", {
      t: ctx.t as (key: string) => string,
    });

    const game = useLastSurvivor({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Start the countdown ticker
    const timerTicker = useTicker(() => game.updateNow(), 1000);
    timerTicker.start();

    // Register actions
    ctx.registerAction("buyKeys", async (keyCount: string) => {
      try {
        const result = await game.buyKeys(keyCount);
        ctx.setStatus(ctx.t("keysPurchased"), "success");
        return result;
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("claimPrize", async () => {
      try {
        await game.claimPrize();
        ctx.setStatus(ctx.t("prizeClaimed"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
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
        platformServices.destroy();
      },
    };
  },
});
