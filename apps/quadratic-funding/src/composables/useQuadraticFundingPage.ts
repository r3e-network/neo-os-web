/**
 * useQuadraticFundingPage — page-level assembly for the Quadratic Funding
 * miniapp, rewritten onto the MiniApp framework SDK (ctx.framework).
 *
 * The page owns the in-card status banner (useStatusMessage policy: sticky
 * errors, auto-dismissed successes) that PlayArea renders, and builds the
 * shared flow kit every composable routes its messaging through. Form
 * handlers return the flow's explicit success boolean — produced by
 * app.notify.guardResult inside the kit — so the view clears its inputs only
 * on a confirmed on-chain success (the legacy `succeededSince` status
 * snapshot is gone).
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { StatsDisplayItem } from "@shared/components";
import type { MiniAppFramework } from "@shared/react";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatAddress } from "@shared/utils/format";
import { createQuadraticFlowKit, type Translator } from "./quadraticFlowKit";
import { useQuadraticRounds } from "./useQuadraticRounds";
import { useQuadraticProjects } from "./useQuadraticProjects";
import { useQuadraticContributions } from "./useQuadraticContributions";
import { computeQuadraticMatches } from "./quadraticMatch";
import type { DepositConfirmation } from "@shared/composables/useContractInteraction";

export interface UseQuadraticFundingPageOptions {
  /** MiniApp framework SDK from ctx.framework — the only service surface. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Deposit-confirmation override for the prepay flows (tests). */
  confirmDeposit?: (
    txid: string,
    assetHash: string,
  ) => Promise<DepositConfirmation>;
}

export function useQuadraticFundingPage({
  app,
  t,
  confirmDeposit,
}: UseQuadraticFundingPageOptions) {
  const activeTab = createObservable("contribute");

  // In-card status banner (PlayArea's `.qf-setup-card__notice` /
  // `.qf-controls__status`). Shared across the rounds/projects/contribution
  // tabs so sub-pages don't silently miss feedback.
  const sm = useStatusMessage();
  const roundsStatus = sm.status;
  const kit = createQuadraticFlowKit({
    app,
    t,
    setStatus: sm.setStatus,
    confirmDeposit,
  });

  const {
    address,
    rounds,
    selectedRoundId,
    selectedRound,
    isAdmin,
    isRefreshingRounds,
    isCreatingRound,
    isAddingMatching,
    isFinalizing,
    isClaimingUnused,
    isCancelling,
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
    canCancelSelectedRound,
    refreshRounds,
    selectRound,
    createRound,
    addMatching,
    finalizeRound,
    finalizeSuggested,
    claimUnused,
    cancelRound,
    roundStatusLabel,
    formatSchedule,
    formatAmount,
  } = useQuadraticRounds({ app, t, kit });

  const {
    projects,
    isRefreshingProjects,
    isRegisteringProject,
    claimingProjectId,
    refreshProjects,
    registerProject,
    canClaimProject,
    claimableProjectIds,
    claimProject,
    projectStatusLabel,
    projectStatusClass,
  } = useQuadraticProjects({ app, t, kit, selectedRound });

  const { isContributing, contributeForm, selectProject, contribute } =
    useQuadraticContributions({
      app,
      t,
      kit,
      selectedRound,
      refreshProjects,
      refreshRounds,
    });

  // Computed display data
  const roundCount = createDerived(() => rounds.get().length, [rounds]);
  const activeRoundCount = createDerived(
    () => rounds.get().filter((round) => round.status === "active").length,
    [rounds],
  );
  const projectCount = createDerived(() => projects.get().length, [projects]);
  const selectedRoundDisplay = createDerived(() => {
    const round = selectedRound.get();
    return round ? round.title || `#${round.id}` : t("notAvailable");
  }, [rounds, selectedRoundId]);
  const matchingPoolDisplay = createDerived(() => {
    const round = selectedRound.get();
    if (!round) return t("notAvailable");
    return `${formatAmount(round.assetSymbol || "GAS", round.matchingPool)} ${round.assetSymbol || "GAS"}`;
  }, [rounds, selectedRoundId]);

  // Suggested quadratic matches for the selected round, computed from each
  // project's on-chain aggregates. Drives the finalize preview table and the
  // pre-filled parallel arrays so operators no longer hand-type JSON.
  const suggestedMatches = createDerived(() => {
    const round = selectedRound.get();
    const list = projects.get();
    if (!round || list.length === 0) {
      return [] as Array<{
        id: string;
        name: string;
        contributedDisplay: string;
        donors: string;
        matchDisplay: string;
        matchBaseUnits: string;
      }>;
    }
    const symbol = round.assetSymbol || "GAS";
    const matches = computeQuadraticMatches(
      list.map((project) => ({
        id: project.id,
        totalContributed: project.totalContributed,
        contributorCount: project.contributorCount,
      })),
      round.matchingPool,
    );
    const matchById = new Map(matches.map((entry) => [entry.id, entry.match]));
    return list.map((project) => {
      const match = matchById.get(project.id) ?? 0n;
      return {
        id: project.id,
        name: project.name || `#${project.id}`,
        contributedDisplay: `${formatAmount(symbol, project.totalContributed)} ${symbol}`,
        donors: String(project.contributorCount),
        matchDisplay: `${formatAmount(symbol, match)} ${symbol}`,
        matchBaseUnits: match.toString(),
      };
    });
  }, [rounds, selectedRoundId, projects]);

  const appState = createDerived(() => ({
    roundCount: roundCount.get(),
    selectedRoundId: selectedRoundId.get(),
  }), [rounds, selectedRoundId]);

  const opStats = createDerived<StatsDisplayItem[]>(() => [
    { label: t("tabRounds"), value: rounds.get().length },
    { label: t("tabProjects"), value: projects.get().length },
    { label: t("sidebarSelectedRound"), value: selectedRoundId.get() ?? t("notAvailable") },
    {
      label: t("sidebarMatchingPool"),
      value: selectedRound.get() ? formatAmount(selectedRound.get()!.matchingPool) : t("notAvailable"),
    },
  ], []);

  // Reuse the shared contract/status channel across tabs so sub-pages don't silently miss feedback.
  const projectsStatus = roundsStatus;
  const contributionStatus = roundsStatus;

  // Form handlers — the flows resolve with app.notify.guardResult's explicit
  // success boolean, so the view can clear its inputs only on a confirmed
  // on-chain success (loading state is bound via the isCreatingRound /
  // isRegisteringProject / isContributing observables). Flows never reject —
  // the kit banners/toasts every failure — so no catch wrapper is needed here.
  const handleCreateRound = createRound;
  const handleRegisterProject = registerProject;
  const handleContribute = contribute;

  const handleAddMatching = async (amount: string) => {
    await addMatching(amount);
  };
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => {
    await finalizeRound(projectIdsRaw, matchedRaw);
  };
  const handleFinalizeSuggested = async () => {
    const entries = suggestedMatches.get().map((entry) => ({ id: entry.id, matchBaseUnits: entry.matchBaseUnits }));
    await finalizeSuggested(entries);
  };
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => {
    await claimProject(project);
  };
  const handleClaimUnused = async () => {
    await claimUnused();
  };
  const handleCancelRound = async () => {
    await cancelRound();
  };
  const handleSelectRound = async (round: Parameters<typeof selectRound>[0]) => {
    selectRound(round);
    await refreshProjects();
  };

  const onTabChange = async (tabId: string) => {
    activeTab.set(tabId);
    if (tabId === "rounds") await refreshRounds();
    if (tabId === "projects" || tabId === "contribute") await refreshProjects();
  };

  // Caller is responsible for invoking refreshRounds() on mount

  return {
    // Wallet (bound so admin capability derives re-render on connect)
    address,
    // Rounds
    rounds,
    selectedRoundId,
    selectedRound,
    isRefreshingRounds,
    isCreatingRound,
    isRegisteringProject,
    isContributing,
    isAddingMatching,
    isFinalizing,
    isClaimingUnused,
    isCancelling,
    isAdmin,
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
    canCancelSelectedRound,
    suggestedMatches,
    roundsStatus,
    refreshRounds,
    selectRound,
    roundStatusLabel,
    formatSchedule,
    formatAmount,
    formatAddress,
    // Projects
    projects,
    isRefreshingProjects,
    claimingProjectId,
    canClaimProject,
    claimableProjectIds,
    projectStatusLabel,
    projectStatusClass,
    // Contributions
    contributeForm,
    selectProject,
    // Tab & display
    activeTab,
    appState,
    opStats,
    roundCount,
    activeRoundCount,
    projectCount,
    selectedRoundDisplay,
    matchingPoolDisplay,
    projectsStatus,
    contributionStatus,
    // Handlers
    handleCreateRound,
    handleRegisterProject,
    handleContribute,
    handleSelectRound,
    handleAddMatching,
    handleFinalize,
    handleFinalizeSuggested,
    handleClaimProject,
    handleClaimUnused,
    handleCancelRound,
    onTabChange,
  };
}
