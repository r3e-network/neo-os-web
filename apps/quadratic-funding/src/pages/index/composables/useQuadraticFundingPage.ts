import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { StatsDisplayItem } from "@shared/components";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { formatAddress } from "@shared/utils/format";

type FormController = {
  setLoading?: (loading: boolean) => void;
  reset?: () => void;
};

export function useQuadraticFundingPage(t: (key: string) => string) {
  const activeTab = createObservable("rounds");

  const {
    address,
    rounds,
    selectedRoundId,
    selectedRound,
    isRefreshingRounds,
    isCreatingRound,
    isAddingMatching,
    isFinalizing,
    isClaimingUnused,
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
    status: roundsStatus,
    refreshRounds,
    selectRound,
    createRound,
    addMatching,
    finalizeRound,
    claimUnused,
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

  // Form refs
  const roundFormRef = createObservable<FormController | null>(null);
  const projectFormRef = createObservable<FormController | null>(null);
  const contributeFormRef = createObservable<FormController | null>(null);

  // Form handlers
  const handleCreateRound = async (data: Parameters<typeof createRound>[0]) => {
    roundFormRef.get()?.setLoading?.(true);
    try {
      await createRound(data);
      if (roundsStatus.get()?.type === "success") roundFormRef.get()?.reset?.();
    } finally {
      roundFormRef.get()?.setLoading?.(false);
    }
  };

  const handleRegisterProject = async (data: Parameters<typeof registerProject>[0]) => {
    projectFormRef.get()?.setLoading?.(true);
    try {
      await registerProject(data);
      if (!roundsStatus.get() || roundsStatus.get().type === "success") projectFormRef.get()?.reset?.();
    } finally {
      projectFormRef.get()?.setLoading?.(false);
    }
  };

  const handleContribute = async (data: Parameters<typeof contribute>[0]) => {
    contributeFormRef.get()?.setLoading?.(true);
    try {
      await contribute(data);
      if (!roundsStatus.get() || roundsStatus.get().type === "success") contributeFormRef.get()?.reset?.();
    } finally {
      contributeFormRef.get()?.setLoading?.(false);
    }
  };

  const handleAddMatching = async (amount: string) => { await addMatching(amount).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => { await finalizeRound(projectIdsRaw, matchedRaw).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => { await claimProject(project).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleClaimUnused = async () => { await claimUnused().catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
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
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
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
    // Form refs
    roundFormRef,
    projectFormRef,
    contributeFormRef,
    // Handlers
    handleCreateRound,
    handleRegisterProject,
    handleContribute,
    handleSelectRound,
    handleAddMatching,
    handleFinalize,
    handleClaimProject,
    handleClaimUnused,
    onTabChange,
  };
}
