/**
 * Flashloan — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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
      badgeService: ctx.framework.badge,
      t: ctx.t,
      network: readMiniAppLaunchContext("miniapp-flashloan").network,
    });

    flash.setAddress(ctx.framework.chain.address.get() ?? "");
    ctx.framework.wallet.onAccountChanged(({ current }) => {
      flash.setAddress(current ?? "");
      void flash.loadData();
    });

    ctx.framework.actions.register("requestLoan", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        amount?: string;
        callbackContract?: string;
        callbackMethod?: string;
      };
      const outcome = await ctx.framework.notify.guardResult(
        () =>
          flash.requestLoan({
            amount: String(data.amount ?? ""),
            callbackContract: String(data.callbackContract ?? ""),
            callbackMethod: String(data.callbackMethod ?? ""),
          }),
        { successKey: "loanSubmitted" },
      );
      return outcome.ok;
    });

    ctx.framework.actions.register("provideLiquidity", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as { amount?: string; receiptId?: string };
      const outcome = await ctx.framework.notify.guardResult(
        () =>
          flash.provideLiquidity(
            String(data.amount ?? ""),
            data.receiptId == null ? undefined : String(data.receiptId),
          ),
        { successKey: "liquidityDeposited" },
      );
      return outcome.ok;
    });

    ctx.framework.actions.register("withdrawLiquidity", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as { amount?: string };
      const outcome = await ctx.framework.notify.guardResult(
        () => flash.withdrawLiquidity(String(data.amount ?? "")),
        { successKey: "liquidityWithdrawn" },
      );
      return outcome.ok;
    });

    ctx.framework.actions.register("resumePendingLiquidity", async () => {
      const outcome = await ctx.framework.notify.guardResult(
        () => flash.resumePendingLiquidity(),
        { successKey: "liquidityDeposited" },
      );
      return outcome.ok;
    });

    ctx.framework.actions.register("connectWallet", async () => {
      const outcome = await ctx.framework.notify.guardResult(async () => {
        const addr = await flash.connect();
        flash.setAddress(addr);
        await flash.loadData();
      }, { successKey: "walletConnected" });
      return outcome.ok;
    });

    ctx.framework.actions.register("lookupLoan", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      if (!id) return;
      // Guard the read so a faulting / non-existent loan surfaces the mapped
      // loanNotFound message instead of a raw VM exception in the toast.
      const outcome = await ctx.framework.notify.guardResult(
        () => flash.lookupLoan(id),
        { errorKey: "loanNotFound" },
      );
      return outcome.ok;
    });

    return {
      state: {
        address: flash.address,
        poolBalance: flash.poolBalance,
        poolBalanceFixed8: flash.poolBalanceFixed8,
        loanDetails: flash.loanDetails,
        stats: flash.stats,
        contractStats: flash.contractStats,
        providerStats: flash.providerStats,
        depositCapability: flash.depositCapability,
        writeCapability: flash.writeCapability,
        contractHealth: flash.contractHealth,
        borrowerEligibility: flash.borrowerEligibility,
        serviceNotice: flash.serviceNotice,
        pendingRequestTxid: flash.pendingRequestTxid,
        pendingLiquidityTxid: flash.pendingLiquidityTxid,
        pendingLiquidityStage: flash.pendingLiquidityStage,
        pendingLiquidityAmount: flash.pendingLiquidityAmount,
        recentLoans: flash.recentLoans,
        lastRequest: flash.lastRequest,
        isLoading: flash.isLoading,
        isLookupLoading: flash.isLookupLoading,
        writeOperation: flash.writeOperation,
        validationError: flash.validationError,
      },
      loadData: async () => {
        flash.setAddress(ctx.framework.chain.address.get() ?? "");
        await flash.loadData();
      },
    };
  },
});
