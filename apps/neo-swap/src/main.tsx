/**
 * Neo Swap -- React Entry Point (OS Services Pattern)
 *
 * Host-native NEO/GAS swap console. Quotes are previewed in the MiniApp
 * playarea before wallet submission.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSwapEngine } from "./hooks/useSwapEngine";

defineMiniApp({
  appId: "miniapp-neo-swap",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const swap = useSwapEngine({
      app: ctx.framework,
      t: ctx.t,
    });

    ctx.framework.actions.registerConnectWallet({ refresh: [swap.refreshBalances] });
    ctx.framework.actions.register("executeSwap", async () => {
      await ctx.framework.notify.guard(() => swap.executeSwap(), { successKey: "swapSuccess" });
    });
    ctx.framework.actions.register("recoverPendingSwap", async () => {
      await ctx.framework.notify.guard(async () => {
        const confirmed = await swap.recoverPendingSwap();
        if (!confirmed) throw new Error(ctx.t("swapStillPending"));
      }, { successKey: "swapRecovered" });
    });
    ctx.framework.actions.register("swapTokens", async () => { swap.swapTokens(); });
    ctx.framework.actions.register("setFromAmount", async (value: unknown) => { swap.setFromAmount(String(value ?? "")); });
    ctx.framework.actions.register("setSlippage", async (value: unknown) => { swap.setSlippage(value as string | number); });
    ctx.framework.actions.register("setMaxAmount", async () => { swap.setMaxAmount(); });
    ctx.framework.actions.register("refreshRate", async () => { await swap.loadExchangeRate(); });
    ctx.framework.actions.register("refreshBalances", async () => { await swap.refreshBalances(); });
    ctx.framework.actions.register("openFromSelector", async () => { swap.openFromSelector(); });
    ctx.framework.actions.register("openToSelector", async () => { swap.openToSelector(); });
    ctx.framework.actions.register("closeSelector", async () => { swap.closeSelector(); });
    ctx.framework.actions.register("selectToken", async (token: unknown) => {
      swap.selectToken(token);
    });

    ctx.framework.actions.register("selectPair", async (...args: unknown[]) => {
      const pairId = String(args[0] ?? "").toLowerCase();
      if (!swap.selectPair(pairId)) {
        ctx.setStatus(ctx.t("pairUnavailable", { pair: pairId.toUpperCase() }), "info");
      }
    });

    return {
      state: {
        fromToken: swap.fromToken,
        toToken: swap.toToken,
        fromAmount: swap.fromAmount,
        toAmount: swap.toAmount,
        exchangeRate: swap.exchangeRate,
        rateError: swap.rateError,
        rateLoading: swap.rateLoading,
        balanceLoading: swap.balanceLoading,
        loading: swap.loading,
        showSelector: swap.showSelector,
        selectorTarget: swap.selectorTarget,
        isSwapping: swap.isSwapping,
        availableTokens: swap.availableTokens,
        canSwap: swap.canSwap,
        swapButtonText: swap.swapButtonText,
        amountError: swap.amountError,
        slippage: swap.slippage,
        slippageValue: swap.slippageValue,
        minReceived: swap.minReceived,
        selectedPairDisplay: swap.selectedPairDisplay,
        pairCount: swap.pairCount,
        currentRate: swap.currentRate,
        routerAvailable: swap.routerAvailable,
        rateStale: swap.rateStale,
        rateAsOf: swap.rateAsOf,
        walletConnected: swap.walletConnected,
        balancesVerified: swap.balancesVerified,
        quoteNetwork: swap.quoteNetwork,
        walletNetwork: swap.walletNetwork,
        networkVerified: swap.networkVerified,
        networkError: swap.networkError,
        transactionStatus: swap.transactionStatus,
        pendingTxid: swap.pendingTxid,
        transactionError: swap.transactionError,
        recovering: swap.recovering,
      },
      loadData: swap.loadAll,
      cleanup: () => { swap.cleanup(); },
    };
  },
});
