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

    const flash = useFlashloanCore();

    ctx.registerAction("lookupLoan", async (loanId: string) => {
      await flash.lookupLoan(
        loanId,
        (msg: string, type: string) => ctx.setStatus(msg, type as "success" | "error" | "loading"),
        (msg: string, type: string) => ctx.setStatus(msg, type as "success" | "error" | "loading"),
      );
    });

    ctx.registerAction("requestLoan", async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
      await flash.requestLoan(
        data,
        (msg: string, type: string) => ctx.setStatus(msg, type as "success" | "error" | "loading"),
        () => {},
        (msg: string, type: string) => ctx.setStatus(msg, type as "success" | "error" | "loading"),
      );
    });

    ctx.registerAction("connect", async () => {
      await flash.connect();
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
