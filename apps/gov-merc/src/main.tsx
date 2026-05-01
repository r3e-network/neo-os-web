/**
 * Gov Merc -- React Entry Point (OS Services Pattern)
 *
 * Uses OS service proxies (ctx.os.payment, ctx.os.storage) for all
 * contract interaction through edge functions.
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovMercPool } from "./hooks/useGovMercPool";

defineMiniApp({
  appId: "miniapp-gov-merc",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pool = useGovMercPool({
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    pool.setAddress(ctx.services.chain.address.get() ?? "");

    const totalPoolDisplay: Observable<string> = {
      get: () => `${pool.formatNum(pool.totalPool.get(), 0)} ${ctx.t("tokenNeo")}`,
      set: () => {},
      subscribe: (fn) => pool.totalPool.subscribe(fn),
    };
    const userDepositsDisplay: Observable<string> = {
      get: () => `${pool.formatNum(pool.userDeposits.get(), 0)} ${ctx.t("tokenNeo")}`,
      set: () => {},
      subscribe: (fn) => pool.userDeposits.subscribe(fn),
    };
    const bidCount: Observable<number> = {
      get: () => pool.bids.get().length,
      set: () => {},
      subscribe: (fn) => pool.bids.subscribe(fn),
    };

    ctx.registerAction("depositNeo", async () => {
      await ctx.services.notify.guard(() => pool.depositNeo(), "depositSuccess");
    });
    ctx.registerAction("withdrawNeo", async () => {
      await ctx.services.notify.guard(() => pool.withdrawNeo(), "withdrawSuccess");
    });
    ctx.registerAction("placeBid", async () => {
      await ctx.services.notify.guard(() => pool.placeBid(), "bidSuccess");
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
        totalPoolDisplay,
        userDepositsDisplay,
        bidCount,
      },
      loadData: pool.loadData,
    };
  },
});
