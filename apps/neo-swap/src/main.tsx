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
    const { notify } = ctx.services;

    const swap = useSwapEngine({
      chain: ctx.services.chain,
      balance: ctx.services.balance,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("executeSwap", async () => {
      await notify.guard(() => swap.executeSwap(), "swapSuccess");
    });
    ctx.registerAction("swapTokens", async () => { swap.swapTokens(); });
    ctx.registerAction("setMaxAmount", async () => { swap.setMaxAmount(); });
    ctx.registerAction("openFromSelector", async () => { swap.openFromSelector(); });
    ctx.registerAction("openToSelector", async () => { swap.openToSelector(); });
    ctx.registerAction("closeSelector", async () => { swap.closeSelector(); });
    ctx.registerAction("selectToken", async (token: unknown) => {
      swap.selectToken(token as { symbol: string; hash: string; balance: number; decimals: number });
    });

    ctx.registerAction("selectPair", async (...args: unknown[]) => {
      const pairId = String(args[0] ?? "").toLowerCase();
      const [fromSym = "", toSym = ""] = pairId.split("-");
      const tokens = swap.availableTokens.get();
      const findToken = (sym: string) => tokens.find((tok) => tok.symbol.toLowerCase() === sym);
      const from = findToken(fromSym);
      const to = findToken(toSym);
      if (from && to) {
        swap.fromToken.set(from);
        swap.toToken.set(to);
        return;
      }
      ctx.setStatus(ctx.t("pairUnavailable") || `Pair ${pairId} unavailable`, "info");
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
        minReceived: swap.minReceived,
      },
      loadData: swap.loadAll,
      cleanup: () => { swap.cleanup(); },
    };
  },
});
