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

defineMiniApp({
  appId: "miniapp-neoburger",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neoburger", {
      t: ctx.t as (key: string) => string,
    });

    const showStatus = (msg: string, type: string) =>
      ctx.setStatus(msg, type as "success" | "error" | "loading");

    const core = useNeoburgerCore();
    const stats = useNeoburgerStats();
    const swap = useNeoburgerSwap(
      core.neoBalance,
      core.bNeoBalance,
      core.BNEO_CONTRACT,
      stats.priceData,
      showStatus,
      core.loadBalances,
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
      } catch (_e: unknown) {
        ctx.setStatus(ctx.t("actionFailed"), "error");
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
      } catch (_e: unknown) {
        ctx.setStatus(ctx.t("claimFailed"), "error");
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
        dailyRewards: computed(() => swap.dailyRewards ?? 0),
        weeklyRewards: computed(() => swap.weeklyRewards ?? 0),
        monthlyRewards: computed(() => swap.monthlyRewards ?? 0),
        totalRewards: computed(() => swap.totalRewards ?? 0),
        totalRewardsUsdText: computed(() => swap.totalRewardsUsdText ?? ""),
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
