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
    const copilot = useAutomationCopilot({ t: ctx.t });

    registerActions(ctx, {
      fetchCurrentPrice: {
        handler: () => copilot.fetchCurrentPrice(),
        successKey: "priceLoaded",
        errorKey: "fetchFailed",
      },
      buildRecipePayload: {
        handler: () => copilot.buildRecipePayload(),
        successKey: "recipeBuilt",
        errorKey: "recipeFailed",
      },
      refreshTriggers: {
        handler: () => copilot.refreshTriggers(),
        successKey: "triggersLoaded",
        errorKey: "triggerListFailed",
      },
      toggleLatestTrigger: {
        handler: () => copilot.toggleLatestTrigger(),
        successKey: "triggerStatusUpdated",
        errorKey: "triggerStatusFailed",
      },
    });

    ctx.registerAction("registerTrigger", async () => {
      try {
        await copilot.registerTrigger();
        const status = copilot.apiStatus.get() || ctx.t("triggerRegistered");
        ctx.setStatus(
          status,
          status === ctx.t("handoffPrepared") ? "info" : "success",
        );
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("triggerFailed"),
          "error",
        );
      }
    });

    ctx.registerAction("selectTrigger", async (...args: unknown[]) => {
      copilot.selectTrigger(String(args[0] ?? ""));
    });

    ctx.registerAction("deleteTrigger", async (...args: unknown[]) => {
      await ctx.services.notify.guard(
        () => copilot.deleteTrigger(String(args[0] ?? "")),
        "triggerDeleted",
        "triggerDeleteFailed",
      );
    });

    return {
      state: {
        asset: copilot.asset,
        targetPrice: copilot.targetPrice,
        schedule: copilot.schedule,
        actionName: copilot.actionName,
        currentPrice: copilot.priceDisplay,
        renderedPayload: copilot.renderedPayload,
        renderedTriggerRequest: copilot.renderedTriggerRequest,
        isRequesting: copilot.isRequesting,
        isRegistering: copilot.isRegistering,
        isRefreshing: copilot.isRefreshing,
        oracleHash: copilot.oracleHash,
        networkDisplay: copilot.networkDisplay,
        datafeedHash: copilot.datafeedHash,
        latestTriggerId: copilot.latestTriggerId,
        latestTriggerState: copilot.latestTriggerState,
        latestTrigger: copilot.latestTrigger,
        triggers: copilot.triggers,
        triggerCount: copilot.triggerCount,
        apiStatus: copilot.apiStatus,
        lastError: copilot.lastError,
      },
      loadData: copilot.loadAll,
    };
  },
});
