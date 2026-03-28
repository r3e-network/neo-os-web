/**
 * Neo Swap — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the swap engine to the platform.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSwapEngine } from "./composables/useSwapEngine";

defineMiniApp({
  appId: "miniapp-neo-swap",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-swap", {
      t: ctx.t as (key: string) => string,
    });

    const swap = useSwapEngine({
      chain: platformServices.chain,
      balance: platformServices.balance,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("executeSwap", async () => {
      try {
        await swap.executeSwap();
        ctx.setStatus(ctx.t("swapSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("swapFailed"), "error");
      }
    });

    ctx.registerAction("swapTokens", async () => { swap.swapTokens(); });
    ctx.registerAction("setMaxAmount", async () => { swap.setMaxAmount(); });
    ctx.registerAction("openFromSelector", async () => { swap.openFromSelector(); });
    ctx.registerAction("openToSelector", async () => { swap.openToSelector(); });
    ctx.registerAction("closeSelector", async () => { swap.closeSelector(); });

    ctx.registerAction("selectToken", async (token: unknown) => {
      swap.selectToken(token as { symbol: string; hash: string; balance: number; decimals: number });
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

      cleanup: () => {
        swap.cleanup();
        platformServices.destroy();
      },
    };
  },
});
