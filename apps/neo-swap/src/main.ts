/**
 * Neo Swap — Entry Point (OS Services Pattern)
 *
 * Wrapper around the external Flamingo swap router and NEO/GAS native
 * contracts. All chain calls target third-party contracts, so they stay
 * on ctx.services.chain. No app-owned state to migrate to OS services.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
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

    ctx.registerAction("swapTokens", async () => {
      swap.swapTokens();
    });
    ctx.registerAction("setMaxAmount", async () => {
      swap.setMaxAmount();
    });
    ctx.registerAction("openFromSelector", async () => {
      swap.openFromSelector();
    });
    ctx.registerAction("openToSelector", async () => {
      swap.openToSelector();
    });
    ctx.registerAction("closeSelector", async () => {
      swap.closeSelector();
    });

    ctx.registerAction("selectToken", async (token: unknown) => {
      swap.selectToken(
        token as {
          symbol: string;
          hash: string;
          balance: number;
          decimals: number;
        },
      );
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
      },
    };
  },
});
