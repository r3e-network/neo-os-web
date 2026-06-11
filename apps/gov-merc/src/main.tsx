/**
 * Gov Merc — React Entry Point
 *
 * Drives the standalone on-chain MiniAppGovMerc contract directly via
 * ctx.services.chain (no OS service proxies). The composable owns all contract
 * reads/writes; this file wires the chain service, the stake/withdraw/bid/settle/
 * claim/reclaim actions, and re-loads data when the wallet connects or switches.
 *
 * ASSET CONVENTION (kept strictly separate end-to-end): NEO is an integer token
 * (Total Pool / Your Deposits are WHOLE NEO, never ×1e8); bids and rewards are
 * GAS (displayed ÷1e8).
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovMerc } from "./hooks/useGovMerc";

defineMiniApp({
  appId: "miniapp-gov-merc",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pool = useGovMerc({
      chain: ctx.services.chain,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    pool.setAddress(ctx.services.chain.address.get() ?? "");

    // The wallet can connect or switch accounts after mount, so re-propagate the
    // address and reload stake/bids/rewards whenever it changes.
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
    // the previous epoch). The amount is GAS (already scaled to whole GAS).
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
      subscribe: (fn) => pool.lastSettlement.subscribe(fn),
    };
    // Connected staker's claimable GAS rewards, formatted (whole GAS ÷1e8).
    const pendingRewardsDisplay: Observable<string> = {
      get: () => `${pool.formatNum(pool.pendingRewards.get(), 4)} ${ctx.t("tokenGas")}`,
      set: () => {},
      subscribe: (fn) => pool.pendingRewards.subscribe(fn),
    };
    // Connected wallet's unused GAS bid credit, formatted (whole GAS ÷1e8).
    const gasCreditDisplay: Observable<string> = {
      get: () => `${pool.formatNum(pool.gasCredit.get(), 4)} ${ctx.t("tokenGas")}`,
      set: () => {},
      subscribe: (fn) => pool.gasCredit.subscribe(fn),
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
    ctx.registerAction("claimRewards", async () => {
      await ctx.services.notify.guard(() => pool.claimRewards(), "claimSuccess");
    });
    ctx.registerAction("reclaimBid", async (epoch: unknown) => {
      await ctx.services.notify.guard(
        () => pool.reclaimBid(Number(epoch)),
        "reclaimSuccess",
      );
    });
    ctx.registerAction("withdrawCredit", async () => {
      await ctx.services.notify.guard(() => pool.withdrawCredit(), "creditWithdrawSuccess");
    });

    return {
      state: {
        totalPool: pool.totalPool,
        currentEpoch: pool.currentEpoch,
        // v2 bidding window: deadline (ms; 0 = unopened) + window length (ms).
        epochDeadline: pool.epochDeadline,
        epochDurationMs: pool.epochDurationMs,
        userDeposits: pool.userDeposits,
        bids: pool.bids,
        pendingRewards: pool.pendingRewards,
        gasCredit: pool.gasCredit,
        reclaimableBids: pool.reclaimableBids,
        depositAmount: pool.depositAmount,
        withdrawAmount: pool.withdrawAmount,
        bidAmount: pool.bidAmount,
        isBusy: pool.isBusy,
        dataLoading: pool.dataLoading,
        address: pool.address,
        hasRewards: pool.hasRewards,
        hasCredit: pool.hasCredit,
        hasReclaimable: pool.hasReclaimable,
        totalPoolDisplay,
        userDepositsDisplay,
        bidCount,
        canSettle,
        lastSettlementDisplay,
        pendingRewardsDisplay,
        gasCreditDisplay,
      },
      loadData: pool.loadData,
      cleanup: () => {
        stopAddressSync();
        pool.dispose();
      },
    };
  },
});
