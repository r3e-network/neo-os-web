/**
 * Quadratic Funding — Entry Point (New Pattern)
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useQuadraticFundingPage } from "./pages/index/composables/useQuadraticFundingPage";

defineMiniApp({
  appId: "miniapp-quadratic-funding",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-quadratic-funding", {
      t: ctx.t as (key: string) => string,
    });

    const qf = useQuadraticFundingPage(ctx.t as (key: string) => string);

    const roundCount = computed(() => qf.rounds.value.length);
    const projectCount = computed(() => qf.projects.value.length);
    const selectedRoundDisplay = computed(() => qf.selectedRoundId.value ?? ctx.t("notAvailable"));
    const matchingPoolDisplay = computed(() =>
      qf.selectedRound.value ? qf.formatAmount(qf.selectedRound.value.matchingPool) : ctx.t("notAvailable"),
    );

    ctx.registerAction("createRound", async (...args: unknown[]) => {
      await qf.handleCreateRound(...args);
    });

    ctx.registerAction("registerProject", async (...args: unknown[]) => {
      await qf.handleRegisterProject(...args);
    });

    ctx.registerAction("contribute", async (...args: unknown[]) => {
      await qf.handleContribute(...args);
    });

    return {
      state: {
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
        roundCount,
        projectCount,
        selectedRoundDisplay,
        matchingPoolDisplay,
      },

      loadData: qf.refreshRounds,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
