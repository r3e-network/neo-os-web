/** Gas Sponsor — production React entry point. */
import { defineMiniApp, refsToObservables } from "@shared/react";
import { readMiniAppLaunchContext } from "@shared/utils/launch-params";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasSponsorApp } from "./composables/useGasSponsor";

defineMiniApp({
  appId: "miniapp-gas-sponsor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const sponsor = useGasSponsorApp({
      app: ctx.framework,
      t: ctx.t,
      network: readMiniAppLaunchContext("miniapp-gas-sponsor").network,
    });

    const publishOutcome = () => {
      const current = sponsor.outcome.get();
      if (current.status === "confirmed") {
        ctx.setStatus(ctx.t("transactionConfirmed"), "success");
      } else if (current.status === "failed") {
        ctx.setStatus(current.message || ctx.t("transactionFaulted"), "error");
      } else if (current.status === "pending" || current.status === "unknown") {
        ctx.setStatus(current.message || ctx.t("transactionPending"), "warning");
      }
      return current;
    };

    const run = async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        const result = await action();
        publishOutcome();
        return result;
      } catch (error) {
        const message = ctx.framework.errors.messageOf(error, ctx.t("actionFailed"));
        ctx.setStatus(message || ctx.t("actionFailed"), "error");
        return null;
      }
    };

    ctx.framework.actions.register("setMode", async (value: unknown) => {
      const next = value === "create" || value === "manage" ? value : "browse";
      sponsor.mode.set(next);
    });

    ctx.framework.actions.register("selectPool", async (value: unknown) =>
      run(() => sponsor.selectPool(String(value ?? ""))));

    ctx.framework.actions.register("loadMorePools", async () =>
      run(() => sponsor.loadMorePools()));

    ctx.framework.actions.register("refreshSelectedPool", async () =>
      run(async () => {
        await sponsor.refreshSelectedPool();
        ctx.setStatus(ctx.t("poolListRefreshed"), "success");
      }));

    ctx.framework.actions.register("connectWallet", async () =>
      run(async () => {
        const address = await sponsor.connectWallet();
        if (address) ctx.setStatus(ctx.t("walletConnected"), "success");
        return address;
      }));

    ctx.framework.actions.register("claimPool", async () =>
      run(() => sponsor.claimFromSelectedPool()));

    ctx.framework.actions.register("createPool", async () =>
      run(() => sponsor.createPublicPool()));

    ctx.framework.actions.register("topUpPool", async () =>
      run(() => sponsor.topUpSelectedPool()));

    ctx.framework.actions.register("extendPool", async () =>
      run(() => sponsor.extendSelectedPool()));

    ctx.framework.actions.register("withdrawPool", async () =>
      run(() => sponsor.withdrawSelectedPool()));

    ctx.framework.actions.register("recoverPending", async () =>
      run(() => sponsor.recoverPendingOperation()));

    ctx.framework.actions.register("resumePending", async () =>
      run(() => sponsor.resumePendingAction()));

    ctx.framework.actions.register("dismissOutcome", async () => {
      sponsor.dismissOutcome();
      ctx.clearStatus();
    });

    return {
      state: refsToObservables({
        mode: sponsor.mode,
        network: sponsor.network,
        contractHash: sponsor.contractHash,
        platformStats: sponsor.platformStats,
        pools: sponsor.pools,
        poolsLoading: sponsor.poolsLoading,
        poolsError: sponsor.poolsError,
        hasMorePools: sponsor.hasMorePools,
        nextPoolCursor: sponsor.nextPoolCursor,
        selectedPoolId: sponsor.selectedPoolId,
        selectedPool: sponsor.selectedPool,
        selectedPoolLoading: sponsor.selectedPoolLoading,
        selectedPoolError: sponsor.selectedPoolError,
        walletAddress: sponsor.walletAddress,
        walletHash: sponsor.walletHash,
        walletContextReady: sponsor.walletContextReady,
        walletGasBalanceFixed8: sponsor.walletGasBalanceFixed8,
        walletGasBalanceKnown: sponsor.walletGasBalanceKnown,
        userClaimedFixed8: sponsor.userClaimedFixed8,
        userClaimedKnown: sponsor.userClaimedKnown,
        pendingOperation: sponsor.pendingOperation,
        outcome: sponsor.outcome,
        actionBusy: sponsor.actionBusy,
        claimAmount: sponsor.claimAmount,
        createAmount: sponsor.createAmount,
        createMaxClaim: sponsor.createMaxClaim,
        createDescription: sponsor.createDescription,
        topUpAmount: sponsor.topUpAmount,
        extendDurationMs: sponsor.extendDurationMs,
        withdrawAmount: sponsor.withdrawAmount,
        canClaim: sponsor.canClaim,
        canCreate: sponsor.canCreate,
        canTopUp: sponsor.canTopUp,
        canWithdraw: sponsor.canWithdraw,
        canExtend: sponsor.canExtend,
        canResumePending: sponsor.canResumePending,
        selectedPoolIsMine: sponsor.selectedPoolIsMine,
        selectedPoolExpired: sponsor.selectedPoolExpired,
        selectedPoolRemainingFixed8: sponsor.selectedPoolRemainingFixed8,
        selectedPoolClaimAvailableRaw: sponsor.selectedPoolClaimAvailableRaw,
      }),
      loadData: sponsor.loadAll,
    };
  },
});
