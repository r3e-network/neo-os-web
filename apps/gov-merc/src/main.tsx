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
import { parseHash160 } from "@shared/utils/neo";
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
      app: ctx.framework,
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
    // Settlement is possible when the live epoch has a bid to resolve. Derive
    // from EITHER the event leaderboard OR the contract's highestBid read, so a
    // degraded events feed cannot wrongly disable settle while highestBid > 0.
    const canSettle: Observable<boolean> = {
      get: () => pool.bids.get().length > 0 || pool.hasLiveBid.get(),
      set: () => {},
      subscribe: (fn) => {
        const stopBids = pool.bids.subscribe(fn);
        const stopLive = pool.hasLiveBid.subscribe(fn);
        return () => {
          stopBids();
          stopLive();
        };
      },
    };
    // Human-readable summary of the most recently resolved epoch (the winner of
    // the previous epoch). The amount is GAS (already scaled to whole GAS).
    const lastSettlementDisplay: Observable<string> = {
      get: () => {
        const s = pool.lastSettlement.get();
        if (!s || !s.winner) return ctx.t("settleNone");
        // settlementWinner is a Hash160 in chain (LE) byte order — normalize to
        // the display-order 0x hash explorers accept before truncating (the raw
        // value is an unrecognizable little-endian hash no explorer resolves).
        const display = parseHash160(s.winner) || s.winner;
        const who = `${display.slice(0, 6)}...${display.slice(-4)}`;
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
    // GAS paid to stakers in the most recently settled epoch — the staker-yield
    // proof, derived from the same settlementAmount read already loaded.
    const lastDistributed: Observable<number> = {
      get: () => pool.lastSettlement.get()?.amount ?? 0,
      set: () => {},
      subscribe: (fn) => pool.lastSettlement.subscribe(fn),
    };

    // Onboarding: explicitly connect a wallet (the stake/bid actions also connect
    // lazily, but a disconnected user gets a clear next-step CTA up front). This
    // only links the wallet and re-propagates the address — no economic logic.
    ctx.framework.actions.register("connectWallet", async () => {
      const addr = await ctx.services.chain.ensureWallet();
      pool.setAddress(addr ?? ctx.services.chain.address.get() ?? "");
      await pool.loadData();
    });
    ctx.framework.actions.register("depositNeo", async () => {
      await ctx.services.notify.guard(() => pool.depositNeo(), "depositSuccess");
    });
    ctx.framework.actions.register("withdrawNeo", async () => {
      await ctx.services.notify.guard(() => pool.withdrawNeo(), "withdrawSuccess");
    });
    ctx.framework.actions.register("placeBid", async () => {
      await ctx.services.notify.guard(() => pool.placeBid(), "bidSuccess");
    });
    ctx.framework.actions.register("settleEpoch", async () => {
      await ctx.services.notify.guard(() => pool.settleEpoch(), "settleSuccess");
    });
    ctx.framework.actions.register("claimRewards", async () => {
      await ctx.services.notify.guard(() => pool.claimRewards(), "claimSuccess");
    });
    ctx.framework.actions.register("reclaimBid", async (epoch: unknown) => {
      await ctx.services.notify.guard(
        () => pool.reclaimBid(Number(epoch)),
        "reclaimSuccess",
      );
    });
    ctx.framework.actions.register("withdrawCredit", async () => {
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
        highestBid: pool.highestBid,
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
        lastDistributed,
      },
      loadData: pool.loadData,
      cleanup: () => {
        stopAddressSync();
        pool.dispose();
      },
    };
  },
});
