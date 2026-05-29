/**
 * Quadratic Funding — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useQuadraticFundingPage } from "./pages/index/composables/useQuadraticFundingPage";

defineMiniApp({
  appId: "miniapp-quadratic-funding",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const qf = useQuadraticFundingPage(ctx.t as (key: string) => string);

    ctx.registerAction("createRound", async (...args: unknown[]) => {
      await qf.handleCreateRound(...args);
    });

    ctx.registerAction("registerProject", async (...args: unknown[]) => {
      await qf.handleRegisterProject(...args);
    });

    ctx.registerAction("contribute", async (...args: unknown[]) => {
      await qf.handleContribute(...args);
    });

    ctx.registerAction("addMatching", async (...args: unknown[]) => {
      const amount = String(args[0] ?? "");
      await qf.handleAddMatching(amount);
    });

    ctx.registerAction("finalize", async (...args: unknown[]) => {
      const projectIdsRaw = String(args[0] ?? "");
      const matchedRaw = String(args[1] ?? "");
      await qf.handleFinalize(projectIdsRaw, matchedRaw);
    });

    ctx.registerAction("claimUnused", async () => {
      await qf.handleClaimUnused();
    });

    ctx.registerAction("refreshRounds", async () => {
      await qf.refreshRounds();
    });

    ctx.registerAction("switchTab", async (...args: unknown[]) => {
      await qf.onTabChange(String(args[0] ?? "rounds"));
    });

    ctx.registerAction("selectRound", async (...args: unknown[]) => {
      await qf.handleSelectRound(args[0] as Parameters<typeof qf.handleSelectRound>[0]);
    });

    return {
      state: refsToObservables({
        rounds: qf.rounds,
        selectedRoundId: qf.selectedRoundId,
        selectedRound: qf.selectedRound,
        isRefreshingRounds: qf.isRefreshingRounds,
        isAddingMatching: qf.isAddingMatching,
        isFinalizing: qf.isFinalizing,
        isClaimingUnused: qf.isClaimingUnused,
        canManageSelectedRound: qf.canManageSelectedRound,
        canFinalizeSelectedRound: qf.canFinalizeSelectedRound,
        canClaimUnused: qf.canClaimUnused,
        roundsStatus: qf.roundsStatus,
        projects: qf.projects,
        isRefreshingProjects: qf.isRefreshingProjects,
        claimingProjectId: qf.claimingProjectId,
        contributeForm: qf.contributeForm,
        projectsStatus: qf.projectsStatus,
        contributionStatus: qf.contributionStatus,
        activeTab: qf.activeTab,
        opStats: qf.opStats,
        roundCount: qf.roundCount,
        activeRoundCount: qf.activeRoundCount,
        projectCount: qf.projectCount,
        selectedRoundDisplay: qf.selectedRoundDisplay,
        matchingPoolDisplay: qf.matchingPoolDisplay,
      }),
      loadData: qf.refreshRounds,
    };
  },
});
