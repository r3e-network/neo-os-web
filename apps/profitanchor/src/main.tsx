/**
 * ProfitAnchor -- React Entry Point (OS Services Pattern)
 *
 * User staking reads and contract mutations use chain services.
 */

import {
  defineMiniApp,
  createObservable,
  createDerived,
} from "@shared/react/defineMiniApp";
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
    const totalNeoDisplay = createDerived(
      () =>
        `${formatNum(anchor.stats.get()?.totalStaked ?? 0)} ${ctx.t("tokenNeo")}`,
      [anchor.stats],
    );
    const rewardReserveDisplay = createDerived(
      () => `${formatNum(anchor.stats.get()?.rewardReserve ?? 0)} GAS`,
      [anchor.stats],
    );
    const agentCount = createDerived(
      () => anchor.stats.get()?.agentCount || agentAccounts.length,
      [anchor.stats],
    );
    const ingressCount = createObservable(21);

    ctx.registerAction("stakeNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(() => anchor.stakeNeo(form.amount), "stakeSubmitted");
    });
    ctx.registerAction("withdrawNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      await notify.guard(
        () => anchor.withdrawNeo(form.amount),
        "withdrawSubmitted",
      );
    });
    ctx.registerAction("claimRewards", async () => {
      await notify.guard(() => anchor.claimRewards(), "rewardsClaimSubmitted");
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
        totalNeoDisplay,
        rewardReserveDisplay,
        agentCount,
        ingressCount,
      },
      loadData: anchor.loadAll,
    };
  },
});
