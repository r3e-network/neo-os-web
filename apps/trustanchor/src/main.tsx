/**
 * TrustAnchor -- React Entry Point (OS Services Pattern)
 *
 * User staking reads and contract mutations use chain services.
 */

import {
  defineMiniApp,
  createObservable,
  createDerived,
} from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { formatNum } from "@shared/utils/format";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  TRUSTANCHOR_AGENT_ACCOUNTS,
  useTrustAnchor,
} from "@shared/composables/trustanchor";

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
  appId: "miniapp-trustanchor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.framework;
    const workflowStatus = createObservable(ctx.t("workflowReady"));
    const lastTxid = createObservable("");
    const lastError = createObservable("");
    const actionHistory = createObservable<AnchorActionHistoryItem[]>([]);

    const anchor = useTrustAnchor({
      app: ctx.framework,
      t: ctx.t,
    });

    const agentAccounts = TRUSTANCHOR_AGENT_ACCOUNTS;

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
      () => {
        const s = anchor.stats.get();
        // Only fall back to the candidate-slot total before stats load.
        // A genuine on-chain 0 must render as 0, not be masked as 21.
        return s ? s.agentCount : agentAccounts.length;
      },
      [anchor.stats],
    );
    const pendingWithdrawDisplay = createDerived(
      () => `${formatNum(anchor.pendingWithdraw.get())} ${ctx.t("tokenNeo")}`,
      [anchor.pendingWithdraw],
    );
    // The on-chain rewardPerNeo accumulator is GAS-datoshi * REWARD_SCALE(1e8)
    // per NEO, i.e. GAS/NEO * 1e16. Divide before display so one distributed
    // GAS per NEO renders as "1.00", not 10,000,000,000,000,000.00.
    const REWARD_PER_NEO_SCALE = 1e16;
    const rewardPerNeoDisplay = createDerived(() => {
      const rps = Number(anchor.stats.get()?.rps ?? 0);
      return Number.isFinite(rps) ? formatNum(rps / REWARD_PER_NEO_SCALE) : formatNum(0);
    }, [anchor.stats]);
    const submitting = createObservable(false);
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
      // Shared in-flight lock: blocks double-submit across PlayArea and the
      // manifest-driven operation panel (both render simultaneously). Set
      // before the first await so a second concurrent NEO transfer can't start.
      if (submitting.get()) return;
      submitting.set(true);
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
      } finally {
        submitting.set(false);
      }
    };

    ctx.framework.actions.register("stakeNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const amount = String(form.amount ?? "");
      return runAnchorAction(
        "submitStake",
        "stakeSubmitted",
        () => anchor.stakeNeo(amount),
        amount,
      );
    });
    ctx.framework.actions.register("withdrawNeo", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const amount = String(form.amount ?? "");
      return runAnchorAction(
        "submitWithdraw",
        "withdrawSubmitted",
        () => anchor.withdrawNeo(amount),
        amount,
      );
    });
    ctx.framework.actions.register("claimRewards", async () => {
      return runAnchorAction(
        "submitClaim",
        "rewardsClaimSubmitted",
        () => anchor.claimRewards(),
      );
    });
    ctx.framework.actions.register("recoverNeoCredit", async () => {
      return runAnchorAction(
        "recoverCredit",
        "creditRecovered",
        () => anchor.recoverNeoCredit(),
      );
    });
    ctx.framework.actions.register("refreshAnchor", async () => {
      if (submitting.get()) return;
      submitting.set(true);
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
      } finally {
        submitting.set(false);
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
        pendingWithdrawDisplay,
        totalNeoDisplay,
        rewardReserveDisplay,
        rewardPerNeoDisplay,
        agentCount,
        submitting,
        workflowStatus,
        lastTxid,
        lastError,
        actionHistory,
      },
      loadData: anchor.loadAll,
    };
  },
});
