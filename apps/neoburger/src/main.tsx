/**
 * NeoBurger -- React Entry Point (OS Services Pattern)
 *
 * Wrapper around the external NeoBurger (bNEO) and NEO native contracts.
 * All chain calls target third-party contracts.
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoburgerCore } from "./hooks/useNeoburgerCore";
import { useNeoburgerSwap } from "./hooks/useNeoburgerSwap";
import { useNeoburgerStats } from "./hooks/useNeoburgerStats";
import { useNeoburgerRewards } from "./hooks/useNeoburgerRewards";

defineMiniApp({
  appId: "miniapp-neoburger",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const core = useNeoburgerCore({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      balance: ctx.services.balance,
      t: ctx.t,
    });

    const stats = useNeoburgerStats(ctx.t);

    const swap = useNeoburgerSwap({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      neoBalance: core.neoBalance,
      bNeoBalance: core.bNeoBalance,
      BNEO_CONTRACT: core.BNEO_CONTRACT,
      priceData: stats.priceData,
      t: ctx.t,
      loadBalances: core.loadBalances,
    });

    const rewards = useNeoburgerRewards(
      core.bNeoBalance,
      stats.apy,
      stats.priceData,
      ctx.t,
    );

    const neoBalanceDisplay: Observable<string> = {
      get: () => String(core.neoBalance.get() ?? ctx.t("notAvailable")),
      set: () => {},
      subscribe: (fn) => core.neoBalance.subscribe(fn),
    };
    const bNeoBalanceDisplay: Observable<string> = {
      get: () => String(core.bNeoBalance.get() ?? ctx.t("notAvailable")),
      set: () => {},
      subscribe: (fn) => core.bNeoBalance.subscribe(fn),
    };
    const loading = createObservable(false);
    const { notify } = ctx.services;

    ctx.registerAction("swap", async () => {
      loading.set(true);
      try {
        const success = await notify.guard(() => swap.executeSwap(), undefined, "actionFailed");
        if (success === false) notify.error("actionFailed");
      } finally { loading.set(false); }
    });

    ctx.registerAction("claimRewards", async () => {
      loading.set(true);
      try {
        const success = await notify.guard(() => core.handleClaimRewards(), undefined, "claimFailed");
        if (success) { notify.success("claimSuccess"); await core.loadBalances(false); }
        else if (success === false) notify.error("claimFailed");
      } finally { loading.set(false); }
    });

    ctx.registerAction("connectWallet", async () => { await core.connectWallet(); });

    return {
      state: {
        neoBalance: core.neoBalance,
        bNeoBalance: core.bNeoBalance,
        walletConnected: core.walletConnected,
        totalStakedDisplay: stats.totalStakedDisplay,
        totalStakedUsdText: stats.totalStakedUsdText,
        aprDisplay: stats.aprDisplay,
        neoBalanceDisplay,
        bNeoBalanceDisplay,
        loading,
        swapMode: swap.swapMode,
        swapAmount: swap.swapAmount,
        swapOutput: swap.swapOutput,
        swapUsdText: swap.swapUsdText,
        swapCanSubmit: swap.swapCanSubmit,
        dailyRewards: rewards.dailyRewards,
        weeklyRewards: rewards.weeklyRewards,
        monthlyRewards: rewards.monthlyRewards,
        totalRewards: rewards.totalRewards,
        totalRewardsUsdText: rewards.totalRewardsUsdText,
      },
      loadData: async () => {
        await core.loadBalances(false);
        await stats.loadApy();
        await stats.loadPrices();
      },
      cleanup: () => { stats.cleanup(); },
    };
  },
});
