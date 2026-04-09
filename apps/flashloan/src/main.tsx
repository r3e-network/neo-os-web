/**
 * Flashloan — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useFlashloanCore } from "./composables/useFlashloanCore";

defineMiniApp({
  appId: "miniapp-flashloan",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const flash = useFlashloanCore({
      lendingService: ctx.os.lending,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    flash.setAddress(ctx.services.chain.address?.get?.() ?? "");

    ctx.registerAction("requestLoan", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => flash.requestLoan(formData as Record<string, unknown>),
        "loanRequested",
      );
    });

    ctx.registerAction("repayLoan", async (loanId: unknown) => {
      await ctx.services.notify.guard(
        () => flash.repayLoan(String(loanId)),
        "loanRepaid",
      );
    });

    return {
      state: {
        pools: flash.pools,
        activeLoans: flash.activeLoans,
        recentLoans: flash.recentLoans,
        isLoading: flash.isLoading,
        isRequesting: flash.isRequesting,
        loanAmount: flash.loanAmount,
        selectedPool: flash.selectedPool,
        totalLiquidity: flash.totalLiquidity,
        totalBorrowed: flash.totalBorrowed,
        activeLoanCount: flash.activeLoanCount,
      },
      loadData: async () => {
        flash.setAddress(ctx.services.chain.address?.get?.() ?? "");
        await flash.loadAll();
      },
    };
  },
});
