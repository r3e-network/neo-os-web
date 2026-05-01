/**
 * Flashloan — React Entry Point
 */

import { defineMiniApp, createDerived } from "@shared/react/defineMiniApp";
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
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    flash.setAddress(ctx.services.chain.address?.get?.() ?? "");
    ctx.services.chain.address.subscribe(() => {
      flash.setAddress(ctx.services.chain.address?.get?.() ?? "");
    });

    ctx.registerAction("requestLoan", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        amount?: string;
        callbackContract?: string;
        callbackMethod?: string;
      };
      await ctx.services.notify.guard(
        () =>
          flash.requestLoan({
            amount: String(data.amount ?? ""),
            callbackContract: String(data.callbackContract ?? ""),
            callbackMethod: String(data.callbackMethod ?? ""),
          }),
        "loanRequested",
      );
    });

    ctx.registerAction("lookupLoan", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      if (!id) return;
      await flash.lookupLoan(id);
    });

    // Surface stats fields individually for the manifest's sidebar bindings.
    const totalLoans = createDerived(
      () => flash.stats.get().totalLoans,
      [flash.stats],
    );
    const totalVolume = createDerived(
      () => flash.stats.get().totalVolume,
      [flash.stats],
    );
    const totalFees = createDerived(
      () => flash.stats.get().totalFees,
      [flash.stats],
    );

    return {
      state: {
        address: flash.address,
        poolBalance: flash.poolBalance,
        loanDetails: flash.loanDetails,
        stats: flash.stats,
        totalLoans,
        totalVolume,
        totalFees,
        recentLoans: flash.recentLoans,
        isLoading: flash.isLoading,
        validationError: flash.validationError,
      },
      loadData: async () => {
        flash.setAddress(ctx.services.chain.address?.get?.() ?? "");
        await flash.loadData();
      },
    };
  },
});
