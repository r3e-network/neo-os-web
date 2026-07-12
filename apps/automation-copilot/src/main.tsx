/**
 * Automation Copilot — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 * Actions register directly on the framework actions table (app.actions);
 * per-action toasts ride the framework's successKey/errorKey handling.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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

    // Framework actions table — success/error toasts (and single-flight
    // handling) come from app.actions, same keys as the legacy registerActions
    // table it replaces.
    ctx.framework.actions.register("fetchCurrentPrice", () => copilot.fetchCurrentPrice(), {
      successKey: "priceLoaded",
      errorKey: "fetchFailed",
    });
    ctx.framework.actions.register("buildRecipePayload", () => copilot.buildRecipePayload(), {
      successKey: "recipeBuilt",
      errorKey: "recipeFailed",
    });
    ctx.framework.actions.register("refreshTriggers", () => copilot.refreshTriggers(), {
      successKey: "triggersLoaded",
      errorKey: "triggerListFailed",
    });
    ctx.framework.actions.register("toggleLatestTrigger", () => copilot.toggleLatestTrigger(), {
      successKey: "triggerStatusUpdated",
      errorKey: "triggerStatusFailed",
    });
    ctx.framework.actions.register("copyTriggerRequest", async () => {
      if (!copilot.triggerRequest.get()) {
        throw new Error(ctx.t("triggerRequestUnavailable"));
      }
      await ctx.framework.clipboard.copy(copilot.renderedTriggerRequest.get(), {
        successKey: "copied",
        errorKey: "copyFailed",
      });
    });

    ctx.framework.actions.register("registerTrigger", async () => {
      try {
        await copilot.registerTrigger();
        const status = copilot.apiStatus.get() || ctx.t("triggerRegistered");
        ctx.setStatus(
          status,
          status === ctx.t("handoffPrepared") ? "info" : "success",
        );
      } catch (error) {
        ctx.setStatus(
          ctx.framework.errors.messageOf(error, ctx.t("triggerFailed")),
          "error",
        );
      }
    });

    ctx.framework.actions.register("selectTrigger", async (...args: unknown[]) => {
      copilot.selectTrigger(String(args[0] ?? ""));
    });

    ctx.framework.actions.register("deleteTrigger", async (...args: unknown[]) => {
      await ctx.framework.notify.guard(
        () => copilot.deleteTrigger(String(args[0] ?? "")),
        { successKey: "triggerDeleted", errorKey: "triggerDeleteFailed" },
      );
    });

    return {
      state: {
        asset: copilot.asset,
        targetPrice: copilot.targetPrice,
        schedule: copilot.schedule,
        actionName: copilot.actionName,
        currentPrice: copilot.priceDisplay,
        priceDataTimestamp: copilot.priceDataTimestamp,
        priceRecordTimestamp: copilot.priceRecordTimestamp,
        priceFreshnessState: copilot.priceFreshnessState,
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
        latestTriggerMode: copilot.latestTriggerMode,
        latestTrigger: copilot.latestTrigger,
        triggers: copilot.triggers,
        triggersLoaded: copilot.triggersLoaded,
        triggerCount: copilot.triggerCount,
        apiStatus: copilot.apiStatus,
        lastError: copilot.lastError,
      },
      loadData: copilot.loadAll,
    };
  },
});
