/**
 * Flashloan — React Entry Point
 */

import { defineMiniApp, createDerived } from "@shared/react/defineMiniApp";
import { readMiniAppLaunchContext } from "@shared/utils/launch-params";
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
      app: ctx.framework,
      badgeService: ctx.os.badge,
      t: ctx.t,
      network: readMiniAppLaunchContext("miniapp-flashloan").network,
    });

    flash.setAddress(ctx.framework.chain.address.get() ?? "");
    ctx.framework.chain.address.subscribe(() => {
      flash.setAddress(ctx.framework.chain.address.get() ?? "");
    });

    ctx.framework.actions.register("requestLoan", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        amount?: string;
        callbackContract?: string;
        callbackMethod?: string;
      };
      await ctx.framework.notify.guard(
        () =>
          flash.requestLoan({
            amount: String(data.amount ?? ""),
            callbackContract: String(data.callbackContract ?? ""),
            callbackMethod: "onFlashLoan",
          }),
        { successKey: "loanSubmitted" },
      );
    });

    ctx.framework.actions.register("provideLiquidity", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as { amount?: string; receiptId?: string };
      await ctx.framework.notify.guard(
        () =>
          flash.provideLiquidity(
            String(data.amount ?? ""),
            data.receiptId == null ? undefined : String(data.receiptId),
          ),
        { successKey: "liquidityDeposited" },
      );
    });

    ctx.framework.actions.register("withdrawLiquidity", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as { amount?: string };
      await ctx.framework.notify.guard(
        () => flash.withdrawLiquidity(String(data.amount ?? "")),
        { successKey: "liquidityWithdrawn" },
      );
    });

    ctx.framework.actions.register("connectWallet", async () => {
      await ctx.framework.notify.guard(async () => {
        const addr = await flash.connect();
        flash.setAddress(addr);
      }, { successKey: "walletConnected" });
    });

    ctx.framework.actions.register("lookupLoan", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      if (!id) return;
      // Guard the read so a faulting / non-existent loan surfaces the mapped
      // loanNotFound message instead of a raw VM exception in the toast.
      await ctx.framework.notify.guard(() => flash.lookupLoan(id), { errorKey: "loanNotFound" });
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
    const avgLoanSize = createDerived(
      () => {
        const snapshot = flash.stats.get();
        return snapshot.totalLoans ? snapshot.totalVolume / snapshot.totalLoans : 0;
      },
      [flash.stats],
    );
    const recentLoansCount = createDerived(
      () => flash.recentLoans.get().length,
      [flash.recentLoans],
    );

    return {
      state: {
        address: flash.address,
        poolBalance: flash.poolBalance,
        loanDetails: flash.loanDetails,
        stats: flash.stats,
        contractStats: flash.contractStats,
        providerStats: flash.providerStats,
        serviceNotice: flash.serviceNotice,
        totalLoans,
        totalVolume,
        totalFees,
        avgLoanSize,
        recentLoansCount,
        recentLoans: flash.recentLoans,
        lastRequest: flash.lastRequest,
        isLoading: flash.isLoading,
        validationError: flash.validationError,
      },
      loadData: async () => {
        flash.setAddress(ctx.framework.chain.address.get() ?? "");
        await flash.loadData();
      },
    };
  },
});
