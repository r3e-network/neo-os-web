/**
 * Gov Merc — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.payment, ctx.os.storage)
 * instead of direct chain calls. The proxies handle all contract interaction
 * through edge functions, so the miniapp never touches contract hashes,
 * parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useGovMercPool({ paymentService, storageService, t })
 *
 * The composable calls:
 *   ctx.os.storage.get("pool-state")           — pool total + epoch
 *   ctx.os.storage.get("user-deposits")        — user deposits
 *   ctx.os.storage.list("bid:")                — epoch bids
 *   ctx.os.payment.deposit(amount, memo)       — GAS for bids
 *   ctx.os.storage.set("deposit", data)        — deposit NEO
 *   ctx.os.storage.set("withdraw", data)       — withdraw NEO
 *   ctx.os.storage.set("bid", data)            — place bid
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovMercPool } from "./composables/useGovMercPool";

defineMiniApp({
  appId: "miniapp-gov-merc",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os (OS service proxies)
   * for all data loading and mutations instead of ctx.services.chain.
   */
  setup(ctx) {
    const pool = useGovMercPool({
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
    });

    // Track wallet address from the platform's chain service
    pool.setAddress(ctx.services.chain.address.value ?? "");

    const totalPoolDisplay = computed(
      () => `${pool.formatNum(pool.totalPool.value, 0)} ${ctx.t("tokenNeo")}`,
    );
    const userDepositsDisplay = computed(
      () =>
        `${pool.formatNum(pool.userDeposits.value, 0)} ${ctx.t("tokenNeo")}`,
    );
    const bidCount = computed(() => pool.bids.value.length);

    registerActions(ctx, {
      depositNeo: { handler: pool.depositNeo, successKey: "depositSuccess" },
      withdrawNeo: { handler: pool.withdrawNeo, successKey: "withdrawSuccess" },
      placeBid: { handler: pool.placeBid, successKey: "bidSuccess" },
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
    };
  },
});
