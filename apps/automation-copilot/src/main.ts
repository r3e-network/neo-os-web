/**
 * Automation Copilot — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the automation recipe builder with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAutomationCopilot } from "./composables/useAutomationCopilot";

defineMiniApp({
  appId: "miniapp-automation-copilot",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const copilot = useAutomationCopilot({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    registerActions(ctx, {
      fetchCurrentPrice: {
        handler: () => copilot.fetchCurrentPrice(),
        successKey: "priceLoaded",
        errorKey: "fetchFailed",
      },
      previewRecipePayload: {
        handler: () => copilot.previewRecipePayload(),
        successKey: "recipeBuilt",
        errorKey: "recipeFailed",
      },
      loadRandomness: {
        handler: () => copilot.loadRandomness(),
        successKey: "randomnessReady",
        errorKey: "randomnessFailed",
      },
      fetchOracleKey: {
        handler: () => copilot.fetchOracleKey(),
        successKey: "keyLoaded",
        errorKey: "keyFailed",
      },
    });

    return {
      state: {
        asset: copilot.asset,
        targetPrice: copilot.targetPrice,
        schedule: copilot.schedule,
        actionName: copilot.actionName,
        currentPrice: copilot.priceDisplay,
        renderedPayload: copilot.renderedPayload,
        isRequesting: copilot.isRequesting,
        oracleHash: copilot.oracleHash,
        networkDisplay: copilot.networkDisplay,
        datafeedHash: copilot.datafeedHash,
        publicApiUrl: copilot.publicApiUrl,
      },
      loadData: copilot.loadAll,
    };
  },
});
