import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { StatsDisplayItem } from "@shared/components";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { computeQuadraticMatches } from "@/composables/quadraticMatch";
import { formatAddress } from "@shared/utils/format";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export function useQuadraticFundingPage(t: (key: string) => string) {
  const activeTab = createObservable("rounds");

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
    status: roundsStatus,
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
    setStatus,
    ensureContractAddress,
  } = useQuadraticRounds();

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
  } = useQuadraticProjects(selectedRound, ensureContractAddress, setStatus);

  const { isContributing, contributeForm, selectProject, contribute, goToContribute } = useQuadraticContributions(
    selectedRound,
    ensureContractAddress,
    setStatus,
    refreshProjects,
    refreshRounds
  );

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
      value: selectedRound.get() ? formatAmount(selectedRound.get().matchingPool) : t("notAvailable"),
    },
  ], []);

  // Reuse the shared contract/status channel across tabs so sub-pages don't silently miss feedback.
  const projectsStatus = roundsStatus;
  const contributionStatus = roundsStatus;

  // Form handlers — return whether the on-chain call succeeded so the view can
  // clear its inputs only on success (loading state is bound via the
  // isCreatingRound / isRegisteringProject / isContributing observables).
  const statusType = (snapshot: unknown): string =>
    snapshot && typeof snapshot === "object" ? String((snapshot as { type?: unknown }).type ?? "") : "";
  const succeededSince = (before: unknown): boolean => {
    const next = roundsStatus.get();
    return Boolean(next && next !== before && statusType(next) === "success");
  };

  const handleCreateRound = async (data: Parameters<typeof createRound>[0]): Promise<boolean> => {
    const before = roundsStatus.get();
    await createRound(data);
    return succeededSince(before);
  };

  const handleRegisterProject = async (data: Parameters<typeof registerProject>[0]): Promise<boolean> => {
    const before = roundsStatus.get();
    await registerProject(data);
    return succeededSince(before);
  };

  const handleContribute = async (data: Parameters<typeof contribute>[0]): Promise<boolean> => {
    const before = roundsStatus.get();
    await contribute(data);
    return succeededSince(before);
  };

  const handleAddMatching = async (amount: string) => { await addMatching(amount).catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); }); };
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => { await finalizeRound(projectIdsRaw, matchedRaw).catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); }); };
  const handleFinalizeSuggested = async () => {
    const entries = suggestedMatches.get().map((entry) => ({ id: entry.id, matchBaseUnits: entry.matchBaseUnits }));
    await finalizeSuggested(entries).catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); });
  };
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => { await claimProject(project).catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); }); };
  const handleClaimUnused = async () => { await claimUnused().catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); }); };
  const handleCancelRound = async () => { await cancelRound().catch((e: unknown) => { setStatus(formatErrorMessage(e, t("actionFailed")), "error"); }); };
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
