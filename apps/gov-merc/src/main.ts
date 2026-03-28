/**
 * Gov Merc — Entry Point (New Pattern)
 */

import { computed } from "vue";
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

    const pool = useGovMercPool({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    const totalPoolDisplay = computed(() => `${pool.formatNum(pool.totalPool.value, 0)} ${ctx.t("tokenNeo")}`);
    const userDepositsDisplay = computed(() => `${pool.formatNum(pool.userDeposits.value, 0)} ${ctx.t("tokenNeo")}`);
    const bidCount = computed(() => pool.bids.value.length);

    ctx.registerAction("depositNeo", async () => {
      try {
        await pool.depositNeo();
        ctx.setStatus(ctx.t("depositSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("withdrawNeo", async () => {
      try {
        await pool.withdrawNeo();
        ctx.setStatus(ctx.t("withdrawSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("placeBid", async () => {
      try {
        await pool.placeBid();
        ctx.setStatus(ctx.t("bidSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
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
