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

    // The wallet can connect or switch accounts after mount, so re-propagate
    // the address and reload deposits/bids whenever it changes. Without this
    // a late-connecting wallet never loads Your Deposits and writes record a
    // stale/empty depositor or bidder.
    const stopAddressSync = ctx.services.chain.address.subscribe(() => {
      pool.setAddress(ctx.services.chain.address.get() ?? "");
      void pool.loadData();
    });

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
    // Settlement is only possible when the live epoch has at least one bid to
    // resolve. Drives the enabled/disabled state of the Route Governance button.
    const canSettle: Observable<boolean> = {
      get: () => pool.bids.get().length > 0,
      set: () => {},
      subscribe: (fn) => pool.bids.subscribe(fn),
    };
    // Human-readable summary of the most recently resolved epoch (the winner of
    // the previous epoch) for the Route Governance panel.
    const lastSettlementDisplay: Observable<string> = {
      get: () => {
        const s = pool.lastSettlement.get();
        if (!s || !s.winner) return ctx.t("settleNone");
        const who = `${s.winner.slice(0, 6)}...${s.winner.slice(-4)}`;
        return ctx.t("settleSummary", {
          epoch: s.epoch,
          winner: who,
          amount: `${pool.formatNum(s.amount, 2)} ${ctx.t("tokenGas")}`,
        });
      },
      set: () => {},
      subscribe: (fn) => {
        const u1 = pool.lastSettlement.subscribe(fn);
        return () => { u1(); };
      },
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
    ctx.registerAction("settleEpoch", async () => {
      await ctx.services.notify.guard(() => pool.settleEpoch(), "settleSuccess");
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
        canSettle,
        lastSettlementDisplay,
      },
      loadData: pool.loadData,
      cleanup: stopAddressSync,
    };
  },
});
