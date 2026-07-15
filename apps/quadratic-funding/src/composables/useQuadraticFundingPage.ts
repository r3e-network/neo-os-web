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
import { useQuadraticSafety } from "./quadraticSafety";
import { useQuadraticPending } from "./quadraticPending";
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
  /** Production-validated `network:contract:fingerprint` entries; defaults to none. */
  approvedRecoveryDeployments?: ReadonlySet<string>;
}

export function useQuadraticFundingPage({
  app,
  t,
  confirmDeposit,
  approvedRecoveryDeployments,
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
    clearStatus: sm.clearStatus,
    confirmDeposit,
  });
  const safety = useQuadraticSafety({ app, t, kit, approvedRecoveryDeployments });
  const pending = useQuadraticPending(app);
  const hasPendingOperation = createDerived(
    () => Boolean(pending.pendingOperation.get()),
    [pending.pendingOperation],
  );
  const pendingTxid = createDerived(
    () => pending.pendingOperation.get()?.txid ?? "",
    [pending.pendingOperation],
  );
  const pendingPhase = createDerived(
    () => pending.pendingOperation.get()?.phase ?? "",
    [pending.pendingOperation],
  );
  let validateFinalizationSnapshot: (projectIds: string[]) => boolean = () => false;

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
    refreshRounds: refreshRoundData,
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
  } = useQuadraticRounds({
    app,
    t,
    kit,
    ensureFundingWritesEnabled: safety.ensureFundingWritesEnabled,
    validateFinalizationSnapshot: (projectIds) => validateFinalizationSnapshot(projectIds),
    pending,
  });

  const {
    projects,
    projectsComplete,
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
  } = useQuadraticProjects({
    app,
    t,
    kit,
    selectedRound,
    ensureFundingWritesEnabled: safety.ensureFundingWritesEnabled,
    pending,
  });

  validateFinalizationSnapshot = (projectIds: string[]) => {
    const round = selectedRound.get();
    const loadedIds = projects.get().map((project) => project.id);
    if (!round || !projectsComplete.get()) return false;
    if (BigInt(loadedIds.length) !== round.projectCount || projectIds.length !== loadedIds.length) {
      return false;
    }
    const submitted = new Set(projectIds);
    return submitted.size === projectIds.length
      && loadedIds.every((projectId) => submitted.has(projectId));
  };

  // Refresh the playable project board with the round snapshot. The previous
  // mount path loaded rounds only, leaving a valid selected round looking empty
  // until the user manually re-selected it.
  const refreshRounds = async () => {
    await Promise.all([
      safety.refreshDeploymentSafety(),
      refreshRoundData(),
    ]);
    try {
      const recovery = await pending.recover();
      if (recovery === "recovered") {
        sm.setStatus(t("pendingRecovered"), "success");
        await refreshRoundData();
      } else if (recovery === "pending") {
        sm.setStatus(t("pendingStillWaiting", { txid: pending.pendingOperation.get()?.txid ?? "" }), "error");
      } else if (recovery === "scope-mismatch") {
        sm.setStatus(t("pendingWrongScope"), "error");
      } else if (recovery === "readback-mismatch") {
        sm.setStatus(t("chainReadbackMismatch"), "error");
      } else if (recovery === "deposit-only") {
        sm.setStatus(t("pendingDepositRecovery", { txid: pending.pendingOperation.get()?.txid ?? "" }), "error");
      } else if (recovery === "uncertain") {
        sm.setStatus(t("pendingIntentUncertain"), "error");
      }
    } catch {
      if (pending.pendingOperation.get()) sm.setStatus(t("pendingRecoveryUnavailable"), "error");
    }
    await refreshProjects();
  };

  const { isContributing, contributeForm, selectProject, contribute } =
    useQuadraticContributions({
      app,
      t,
      kit,
      selectedRound,
      refreshProjects,
      refreshRounds,
      ensureFundingWritesEnabled: safety.ensureFundingWritesEnabled,
      pending,
    });

  // Computed display data
  const roundCount = createDerived(() => rounds.get().length, [rounds]);
  const activeRoundCount = createDerived(
    () => rounds.get().filter((round) => round.status === "active").length,
    [rounds],
  );
  const projectCount = createDerived(() => projects.get().length, [projects]);
  // Every readout below describes THE SELECTED ROUND, and no round is selected
  // until one is loaded — the state the desk opens in and explicitly asks the
  // visitor to resolve ("Select a round before contributing"). Rendering that
  // as "N/A" put three dead abbreviations on the entry surface for a condition
  // the headline already names. Say what is true instead: no round yet.
  const selectedRoundDisplay = createDerived(() => {
    const round = selectedRound.get();
    return round ? round.title || `#${round.id}` : t("qfNoRoundSelected");
  }, [rounds, selectedRoundId]);
  const matchingPoolDisplay = createDerived(() => {
    const round = selectedRound.get();
    if (!round) return t("qfMatchingAwaitsRound");
    return `${formatAmount(round.assetSymbol || "GAS", round.matchingPool)} ${round.assetSymbol || "GAS"}`;
  }, [rounds, selectedRoundId]);
  const matchingRemainingDisplay = createDerived(() => {
    const round = selectedRound.get();
    if (!round) return t("qfMatchingAwaitsRound");
    return `${formatAmount(round.assetSymbol || "GAS", round.matchingRemaining)} ${round.assetSymbol || "GAS"}`;
  }, [rounds, selectedRoundId]);
  const matchPreviewMode = createDerived(
    () => selectedRound.get()?.finalized ? "finalized" : "estimate",
    [rounds, selectedRoundId],
  );

  // Suggested quadratic matches for the selected round, computed from each
  // project's on-chain aggregates. Drives the finalize preview table and the
  // pre-filled parallel arrays so operators no longer hand-type JSON.
  const suggestedMatches = createDerived(() => {
    const round = selectedRound.get();
    const list = projects.get();
    if (!round || !projectsComplete.get() || list.length === 0) {
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
    const matches = round.finalized
      ? list.map((project) => ({ id: project.id, weight: 0n, match: project.matchedAmount }))
      : computeQuadraticMatches(
          list.map((project) => ({
            id: project.id,
            totalContributed: project.totalContributed,
            contributorCount: project.contributorCount,
            eligible: project.active && !project.claimed,
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
  }, [rounds, selectedRoundId, projects, projectsComplete]);

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
      value: selectedRound.get()
        ? `${formatAmount(selectedRound.get()!.assetSymbol, selectedRound.get()!.matchingPool)} ${selectedRound.get()!.assetSymbol}`
        : t("notAvailable"),
    },
  ], [rounds, projects, selectedRoundId]);

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
    return addMatching(amount);
  };
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => {
    await finalizeRound(projectIdsRaw, matchedRaw);
  };
  const handleFinalizeSuggested = async () => {
    const entries = suggestedMatches.get().map((entry) => ({ id: entry.id, matchBaseUnits: entry.matchBaseUnits }));
    return finalizeSuggested(entries);
  };
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => {
    return claimProject(project);
  };
  const handleClaimUnused = async () => {
    return claimUnused();
  };
  const handleCancelRound = async () => {
    return cancelRound();
  };
  const handleClearPending = () => {
    if (
      isCreatingRound.get()
      || isRegisteringProject.get()
      || isContributing.get()
      || isAddingMatching.get()
      || isFinalizing.get()
      || isClaimingUnused.get()
      || isCancelling.get()
      || Boolean(claimingProjectId.get())
    ) {
      sm.setStatus(t("pendingBlocksWrites"), "error");
      return;
    }
    if (pending.pendingOperation.get()?.phase === "deposit") {
      sm.setStatus(t("pendingDepositMustRecover"), "error");
      return;
    }
    pending.clear();
    sm.setStatus(t("pendingCleared"), "success");
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
    deploymentStatus: safety.deploymentStatus,
    deploymentMessage: safety.deploymentMessage,
    isCheckingDeployment: safety.isCheckingDeployment,
    fundingWritesEnabled: safety.fundingWritesEnabled,
    pendingOperation: pending.pendingOperation,
    hasPendingOperation,
    pendingTxid,
    pendingPhase,
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
    projectsComplete,
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
    matchingRemainingDisplay,
    matchPreviewMode,
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
    handleClearPending,
    onTabChange,
  };
}
