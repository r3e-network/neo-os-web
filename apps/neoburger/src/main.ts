/**
 * NeoBurger — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoburgerCore } from "./composables/useNeoburgerCore";
import { useNeoburgerSwap } from "./composables/useNeoburgerSwap";
import { useNeoburgerStats } from "./composables/useNeoburgerStats";
import { useNeoburgerRewards } from "./composables/useNeoburgerRewards";

defineMiniApp({
  appId: "miniapp-neoburger",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const core = useNeoburgerCore({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      balance: platformServices.balance,
      t: ctx.t,
    });

    const stats = useNeoburgerStats(ctx.t);

    const swap = useNeoburgerSwap({
      chain: platformServices.chain,
      eventBus: platformServices.events,
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

    const neoBalanceDisplay = computed(() =>
      String(core.neoBalance.value ?? ctx.t("notAvailable")),
    );
    const bNeoBalanceDisplay = computed(() =>
      String(core.bNeoBalance.value ?? ctx.t("notAvailable")),
    );
    const loading = ref(false);

    const { notify } = platformServices;

    ctx.registerAction("swap", async () => {
      loading.value = true;
      try {
        const success = await notify.guard(
          () => swap.executeSwap(),
          undefined,
          "actionFailed",
        );
        if (success === false) {
          notify.error("actionFailed");
        }
      } finally {
        loading.value = false;
      }
    });

    ctx.registerAction("claimRewards", async () => {
      loading.value = true;
      try {
        const success = await notify.guard(
          () => core.handleClaimRewards(),
          undefined,
          "claimFailed",
        );
        if (success) {
          notify.success("claimSuccess");
          await core.loadBalances(false);
        } else if (success === false) {
          notify.error("claimFailed");
        }
      } finally {
        loading.value = false;
      }
    });

    ctx.registerAction("connectWallet", async () => {
      await core.connectWallet();
    });

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
        // Swap sub-state
        swapMode: swap.swapMode,
        swapAmount: swap.swapAmount,
        swapOutput: swap.swapOutput,
        swapUsdText: swap.swapUsdText,
        swapCanSubmit: swap.swapCanSubmit,
        // Rewards sub-state
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

      cleanup: () => {
        stats.cleanup();
      },
    };
  },
});
