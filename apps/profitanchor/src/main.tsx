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

type AnchorActionHistoryItem = {
  action: string;
  amount?: string;
  status: string;
  txid?: string;
  at: string;
};

type AnchorTxResult = {
  txid?: string;
};

defineMiniApp({
  appId: "miniapp-profitanchor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;
    const formatNum = (n: number | string) => formatNumber(n, 2);
    const workflowStatus = createObservable(ctx.t("workflowReady"));
    const lastTxid = createObservable("");
    const lastError = createObservable("");
    const actionHistory = createObservable<AnchorActionHistoryItem[]>([]);

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
    const recordAction = (item: Omit<AnchorActionHistoryItem, "at">) => {
      actionHistory.set([
        { ...item, at: new Date().toISOString() },
        ...actionHistory.get(),
      ].slice(0, 6));
    };

    const runAnchorAction = async (
      actionLabelKey: string,
      successKey: string,
      run: () => Promise<AnchorTxResult | undefined>,
      amount?: string,
    ) => {
      workflowStatus.set(ctx.t("workflowSubmitting"));
      lastError.set("");
      try {
        const result = await run();
        const txid = result?.txid ?? "";
        lastTxid.set(txid);
        workflowStatus.set(ctx.t(successKey));
        recordAction({
          action: ctx.t(actionLabelKey),
          amount,
          status: ctx.t(successKey),
          txid,
        });
        notify.success(successKey);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : ctx.t("workflowFailed");
        lastError.set(message);
        workflowStatus.set(ctx.t("workflowFailed"));
        notify.error(error, "anchorActionFailed");
        throw error;
      }
    };

    ctx.registerAction("stakeNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const amount = String(form.amount ?? "");
      return runAnchorAction(
        "submitStake",
        "stakeSubmitted",
        () => anchor.stakeNeo(amount),
        amount,
      );
    });
    ctx.registerAction("withdrawNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const amount = String(form.amount ?? "");
      return runAnchorAction(
        "submitWithdraw",
        "withdrawSubmitted",
        () => anchor.withdrawNeo(amount),
        amount,
      );
    });
    ctx.registerAction("claimRewards", async () => {
      return runAnchorAction(
        "submitClaim",
        "rewardsClaimSubmitted",
        () => anchor.claimRewards(),
      );
    });
    ctx.registerAction("refreshAnchor", async () => {
      workflowStatus.set(ctx.t("workflowSubmitting"));
      lastError.set("");
      try {
        await anchor.loadAll();
        workflowStatus.set(ctx.t("workflowRefreshed"));
        recordAction({
          action: ctx.t("refreshStatus"),
          status: ctx.t("workflowRefreshed"),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : ctx.t("workflowFailed");
        lastError.set(message);
        workflowStatus.set(ctx.t("workflowFailed"));
        throw error;
      }
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
        workflowStatus,
        lastTxid,
        lastError,
        actionHistory,
      },
      loadData: anchor.loadAll,
    };
  },
});
