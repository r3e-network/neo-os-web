/**
 * Quadratic Funding — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useQuadraticFundingPage } from "./composables/useQuadraticFundingPage";
import type { ProjectItem } from "./composables/quadraticTypes";

defineMiniApp({
  appId: "miniapp-quadratic-funding",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const qf = useQuadraticFundingPage({ app: ctx.framework, t: ctx.t });

    // These three return a success boolean so the view can clear its inputs
    // only on a confirmed on-chain success (dispatch forwards the payload).
    ctx.framework.actions.register("createRound", async (...args: unknown[]) => {
      return qf.handleCreateRound(...(args as Parameters<typeof qf.handleCreateRound>));
    });

    ctx.framework.actions.register("registerProject", async (...args: unknown[]) => {
      return qf.handleRegisterProject(...(args as Parameters<typeof qf.handleRegisterProject>));
    });

    ctx.framework.actions.register("contribute", async (...args: unknown[]) => {
      return qf.handleContribute(...(args as Parameters<typeof qf.handleContribute>));
    });

    ctx.framework.actions.register("addMatching", async (...args: unknown[]) => {
      const amount = String(args[0] ?? "");
      return qf.handleAddMatching(amount);
    });

    ctx.framework.actions.register("finalize", async (...args: unknown[]) => {
      const projectIdsRaw = String(args[0] ?? "");
      const matchedRaw = String(args[1] ?? "");
      await qf.handleFinalize(projectIdsRaw, matchedRaw);
    });

    ctx.framework.actions.register("finalizeSuggested", async () => {
      await qf.handleFinalizeSuggested();
    });

    ctx.framework.actions.register("claimProject", async (...args: unknown[]) => {
      await qf.handleClaimProject(args[0] as ProjectItem);
    });

    ctx.framework.actions.register("claimUnused", async () => {
      await qf.handleClaimUnused();
    });

    ctx.framework.actions.register("cancelRound", async () => {
      await qf.handleCancelRound();
    });

    ctx.framework.actions.register("clearPending", async () => {
      qf.handleClearPending();
    });

    ctx.framework.actions.register("refreshRounds", async () => {
      await qf.refreshRounds();
    });

    ctx.framework.actions.register("switchTab", async (...args: unknown[]) => {
      await qf.onTabChange(String(args[0] ?? "contribute"));
    });

    ctx.framework.actions.register("selectRound", async (...args: unknown[]) => {
      await qf.handleSelectRound(args[0] as Parameters<typeof qf.handleSelectRound>[0]);
    });

    return {
      state: refsToObservables({
        address: qf.address,
        rounds: qf.rounds,
        selectedRoundId: qf.selectedRoundId,
        selectedRound: qf.selectedRound,
        isRefreshingRounds: qf.isRefreshingRounds,
        isCreatingRound: qf.isCreatingRound,
        isRegisteringProject: qf.isRegisteringProject,
        isContributing: qf.isContributing,
        isAddingMatching: qf.isAddingMatching,
        isFinalizing: qf.isFinalizing,
        isClaimingUnused: qf.isClaimingUnused,
        isCancelling: qf.isCancelling,
        deploymentStatus: qf.deploymentStatus,
        deploymentMessage: qf.deploymentMessage,
        isCheckingDeployment: qf.isCheckingDeployment,
        fundingWritesEnabled: qf.fundingWritesEnabled,
        pendingOperation: qf.pendingOperation,
        hasPendingOperation: qf.hasPendingOperation,
        pendingTxid: qf.pendingTxid,
        pendingPhase: qf.pendingPhase,
        isAdmin: qf.isAdmin,
        canManageSelectedRound: qf.canManageSelectedRound,
        canFinalizeSelectedRound: qf.canFinalizeSelectedRound,
        canClaimUnused: qf.canClaimUnused,
        canCancelSelectedRound: qf.canCancelSelectedRound,
        suggestedMatches: qf.suggestedMatches,
        roundsStatus: qf.roundsStatus,
        projects: qf.projects,
        projectsComplete: qf.projectsComplete,
        isRefreshingProjects: qf.isRefreshingProjects,
        claimingProjectId: qf.claimingProjectId,
        claimableProjectIds: qf.claimableProjectIds,
        // NOTE: qf.contributeForm (a plain mutable object, not a ref) is NOT
        // exposed here — refsToObservables silently dropped it pre-rewrite
        // (no .value / .get), so the state key never existed for the view.
        projectsStatus: qf.projectsStatus,
        contributionStatus: qf.contributionStatus,
        activeTab: qf.activeTab,
        opStats: qf.opStats,
        roundCount: qf.roundCount,
        activeRoundCount: qf.activeRoundCount,
        projectCount: qf.projectCount,
        selectedRoundDisplay: qf.selectedRoundDisplay,
        matchingPoolDisplay: qf.matchingPoolDisplay,
        matchingRemainingDisplay: qf.matchingRemainingDisplay,
        matchPreviewMode: qf.matchPreviewMode,
      }),
      loadData: qf.refreshRounds,
    };
  },
});
