/**
 * Automation Copilot — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 * registerActions is framework-agnostic (no Vue deps), so it works as-is.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAutomationCopilot } from "./composables/useAutomationCopilot";

defineMiniApp({
  appId: "miniapp-automation-copilot",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const copilot = useAutomationCopilot({
      oracle: ctx.services.oracle,
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
