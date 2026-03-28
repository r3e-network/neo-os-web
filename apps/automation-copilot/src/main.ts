/**
 * Automation Copilot — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the automation recipe builder with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-automation-copilot", {
      t: ctx.t as (key: string) => string,
    });

    const copilot = useAutomationCopilot({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("fetchCurrentPrice", async () => {
      try {
        await copilot.fetchCurrentPrice();
        ctx.setStatus(ctx.t("priceLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("fetchFailed"), "error");
      }
    });

    ctx.registerAction("previewRecipePayload", async () => {
      try {
        copilot.previewRecipePayload();
        ctx.setStatus(ctx.t("recipeBuilt"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("recipeFailed"), "error");
      }
    });

    ctx.registerAction("loadRandomness", async () => {
      try {
        await copilot.loadRandomness();
        ctx.setStatus(ctx.t("randomnessReady"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("randomnessFailed"), "error");
      }
    });

    ctx.registerAction("fetchOracleKey", async () => {
      try {
        await copilot.fetchOracleKey();
        ctx.setStatus(ctx.t("keyLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("keyFailed"), "error");
      }
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
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
