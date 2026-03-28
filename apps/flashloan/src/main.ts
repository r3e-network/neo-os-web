/**
 * Flash Loan — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the flashloan composable to the platform.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useFlashloanCore } from "./composables/useFlashloanCore";

defineMiniApp({
  appId: "miniapp-flashloan",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-flashloan", {
      t: ctx.t as (key: string) => string,
    });

    const flash = useFlashloanCore({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    ctx.registerAction("lookupLoan", async (loanId: string) => {
      try {
        await flash.lookupLoan(loanId);
        ctx.setStatus(ctx.t("loanStatusLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("requestLoan", async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
      try {
        await flash.requestLoan(data);
        ctx.setStatus(ctx.t("loanRequested"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("connect", async () => {
      try {
        await flash.connect();
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    return {
      state: {
        // Stats grid values
        poolBalance: flash.poolBalance,
        totalLoans: flash.stats,
        totalVolume: flash.stats,
        totalFees: flash.stats,
        avgLoanSize: flash.stats,

        // Sidebar values
        recentLoansCount: flash.recentLoans,

        // PlayArea state
        loanDetails: flash.loanDetails,
        isLoading: flash.isLoading,
        validationError: flash.validationError,
        isConnected: flash.address,
        recentLoans: flash.recentLoans,
      },

      loadData: flash.loadData,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
