/**
 * NeoBurger — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-neoburger", {
      t: ctx.t as (key: string) => string,
    });

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

    const neoBalanceDisplay = computed(() => String(core.neoBalance.value ?? ctx.t("notAvailable")));
    const bNeoBalanceDisplay = computed(() => String(core.bNeoBalance.value ?? ctx.t("notAvailable")));
    const loading = ref(false);

    ctx.registerAction("swap", async () => {
      try {
        loading.value = true;
        const success = await swap.executeSwap();
        if (!success) {
          ctx.setStatus(ctx.t("actionFailed"), "error");
        }
      } catch (_e) {
        ctx.setStatus(_e instanceof Error ? _e.message : ctx.t("actionFailed"), "error");
      } finally {
        loading.value = false;
      }
    });

    ctx.registerAction("claimRewards", async () => {
      try {
        loading.value = true;
        const success = await core.handleClaimRewards();
        if (success) {
          ctx.setStatus(ctx.t("claimSuccess"), "success");
          await core.loadBalances(false);
        } else {
          ctx.setStatus(ctx.t("claimFailed"), "error");
        }
      } catch (_e) {
        ctx.setStatus(_e instanceof Error ? _e.message : ctx.t("claimFailed"), "error");
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
        platformServices.destroy();
      },
    };
  },
});
