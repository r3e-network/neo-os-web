/**
 * ProfitAnchor -- React Entry Point (OS Services Pattern)
 *
 * User stake/reward reads and contract mutations use OS services.
 * NEO native transfer for staking stays on ctx.services.chain.
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { formatNumber } from "@shared/utils/format";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useProfitAnchor } from "./hooks/useProfitAnchor";
import { PROFITANCHOR_AGENT_ACCOUNTS } from "./pages/index/data/agentAccounts";

defineMiniApp({
  appId: "miniapp-profitanchor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;
    const formatNum = (n: number | string) => formatNumber(n, 2);

    const anchor = useProfitAnchor({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    const agentAccounts = PROFITANCHOR_AGENT_ACCOUNTS;

    const myStakeDisplay: Observable<string> = {
      get: () => `${formatNum(anchor.myStake.get())} ${ctx.t("tokenNeo")}`,
      set: () => {},
      subscribe: (fn) => anchor.myStake.subscribe(fn),
    };
    const pendingRewardsDisplay: Observable<string> = {
      get: () => `${formatNum(anchor.pendingRewards.get())} GAS`,
      set: () => {},
      subscribe: (fn) => anchor.pendingRewards.subscribe(fn),
    };
    const agentCount = createObservable(agentAccounts.length);
    const ingressCount = createObservable(21);

    ctx.registerAction("stake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      await notify.guard(() => anchor.stake(amount), "stakeSuccess");
    });
    ctx.registerAction("unstake", async (...args: unknown[]) => {
      const amount = args[0] as number;
      if (!amount || amount <= 0) return;
      await notify.guard(() => anchor.unstake(amount), "unstakeSuccess");
    });
    ctx.registerAction("claimRewards", async () => {
      await notify.guard(() => anchor.claimRewards(), "claimSuccess");
    });
    ctx.registerAction("claimPendingWithdraw", async () => {
      await notify.guard(() => anchor.claimPendingWithdraw(), "withdrawSuccess");
    });

    return {
      state: {
        stats: anchor.stats,
        myStake: anchor.myStake,
        pendingRewards: anchor.pendingRewards,
        pendingWithdraw: anchor.pendingWithdraw,
        agentAccounts: createObservable(agentAccounts),
        myStakeDisplay,
        pendingRewardsDisplay,
        agentCount,
        ingressCount,
      },
      loadData: anchor.loadAll,
    };
  },
});
