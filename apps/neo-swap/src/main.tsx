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

    ctx.framework.actions.register("connectWallet", async () => {
      await ctx.framework.notify.guard(async () => {
        await ctx.framework.wallet.ensure();
        await swap.refreshBalances();
      });
    });
    ctx.framework.actions.register("executeSwap", async () => {
      await ctx.framework.notify.guard(() => swap.executeSwap(), { successKey: "swapSuccess" });
    });
    ctx.framework.actions.register("swapTokens", async () => { swap.swapTokens(); });
    ctx.framework.actions.register("setFromAmount", async (value: unknown) => { swap.setFromAmount(String(value ?? "")); });
    ctx.framework.actions.register("setSlippage", async (value: unknown) => { swap.setSlippage(value as string | number); });
    ctx.framework.actions.register("setMaxAmount", async () => { swap.setMaxAmount(); });
    ctx.framework.actions.register("refreshRate", async () => { await swap.loadExchangeRate(); });
    ctx.framework.actions.register("openFromSelector", async () => { swap.openFromSelector(); });
    ctx.framework.actions.register("openToSelector", async () => { swap.openToSelector(); });
    ctx.framework.actions.register("closeSelector", async () => { swap.closeSelector(); });
    ctx.framework.actions.register("selectToken", async (token: unknown) => {
      swap.selectToken(token as { symbol: string; hash: string; balance: number; decimals: number });
    });

    ctx.framework.actions.register("selectPair", async (...args: unknown[]) => {
      const pairId = String(args[0] ?? "").toLowerCase();
      const [fromSym = "", toSym = ""] = pairId.split("-");
      const tokens = swap.availableTokens.get();
      const findToken = (sym: string) => tokens.find((tok) => tok.symbol.toLowerCase() === sym);
      const from = findToken(fromSym);
      const to = findToken(toSym);
      if (from && to) {
        swap.fromToken.set(from);
        swap.toToken.set(to);
        swap.fromAmount.set("");
        swap.toAmount.set("");
        swap.loadExchangeRate().catch(() => {});
        return;
      }
      ctx.setStatus(ctx.t("pairUnavailable", { pair: pairId.toUpperCase() }), "info");
    });

    return {
      state: {
        fromToken: swap.fromToken,
        toToken: swap.toToken,
        fromAmount: swap.fromAmount,
        toAmount: swap.toAmount,
        exchangeRate: swap.exchangeRate,
        rateLoading: swap.rateLoading,
        loading: swap.loading,
        showSelector: swap.showSelector,
        selectorTarget: swap.selectorTarget,
        isSwapping: swap.isSwapping,
        availableTokens: swap.availableTokens,
        canSwap: swap.canSwap,
        swapButtonText: swap.swapButtonText,
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
      },
      loadData: swap.loadAll,
      cleanup: () => { swap.cleanup(); },
    };
  },
});
