/**
 * Gov Merc — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovMercPool } from "./composables/useGovMercPool";

defineMiniApp({
  appId: "miniapp-gov-merc",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-gov-merc", {
      t: ctx.t as (key: string) => string,
    });

    const pool = useGovMercPool(ctx.t as (key: string) => string);

    const totalPoolDisplay = computed(() => `${pool.formatNum(pool.totalPool.value, 0)} ${ctx.t("tokenNeo")}`);
    const userDepositsDisplay = computed(() => `${pool.formatNum(pool.userDeposits.value, 0)} ${ctx.t("tokenNeo")}`);
    const bidCount = computed(() => pool.bids.value.length);

    ctx.registerAction("depositNeo", async () => {
      await pool.depositNeo();
    });

    ctx.registerAction("withdrawNeo", async () => {
      await pool.withdrawNeo();
    });

    ctx.registerAction("placeBid", async () => {
      await pool.placeBid();
    });

    return {
      state: {
        totalPool: pool.totalPool,
        currentEpoch: pool.currentEpoch,
        userDeposits: pool.userDeposits,
        bids: pool.bids,
        depositAmount: pool.depositAmount,
        withdrawAmount: pool.withdrawAmount,
        bidAmount: pool.bidAmount,
        isBusy: pool.isBusy,
        dataLoading: pool.dataLoading,
        status: pool.status,
        address: pool.address,
        poolStats: pool.poolStats,
        totalPoolDisplay,
        userDepositsDisplay,
        bidCount,
      },

      loadData: pool.loadData,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
