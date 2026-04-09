import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { StatsDisplayItem } from "@shared/components";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { formatAddress } from "@shared/utils/format";
import type RoundForm from "../components/RoundForm";
import type ProjectForm from "../components/ProjectForm";
import type ContributionForm from "../components/ContributionForm";

export function useQuadraticFundingPage(t: (key: string) => string) {
  const activeTab = createObservable("rounds");

  const {
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
  const appState = createDerived(() => ({
    roundCount: rounds.get().length,
    selectedRoundId: selectedRoundId.get(),
  }), []);

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
  const roundFormRef = createObservable<InstanceType<typeof RoundForm> | null>(null);
  const projectFormRef = createObservable<InstanceType<typeof ProjectForm> | null>(null);
  const contributeFormRef = createObservable<InstanceType<typeof ContributionForm> | null>(null);

  // Form handlers
  const handleCreateRound = async (data: Parameters<typeof createRound>[0]) => {
    roundFormRef.get()?.setLoading(true);
    try {
      await createRound(data);
      if (roundsStatus.get()?.type === "success") roundFormRef.get()?.reset();
    } finally {
      roundFormRef.get()?.setLoading(false);
    }
  };

  const handleRegisterProject = async (data: Parameters<typeof registerProject>[0]) => {
    projectFormRef.get()?.setLoading(true);
    try {
      await registerProject(data);
      if (!roundsStatus.get() || roundsStatus.get().type === "success") projectFormRef.get()?.reset();
    } finally {
      projectFormRef.get()?.setLoading(false);
    }
  };

  const handleContribute = async (data: Parameters<typeof contribute>[0]) => {
    contributeFormRef.get()?.setLoading(true);
    try {
      await contribute(data);
      if (!roundsStatus.get() || roundsStatus.get().type === "success") contributeFormRef.get()?.reset();
    } finally {
      contributeFormRef.get()?.setLoading(false);
    }
  };

  const handleAddMatching = async (amount: string) => { await addMatching(amount).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => { await finalizeRound(projectIdsRaw, matchedRaw).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => { await claimProject(project).catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };
  const handleClaimUnused = async () => { await claimUnused().catch((e: unknown) => { setStatus(String(e instanceof Error ? e.message : e), "error"); }); };

  const onTabChange = async (tabId: string) => {
    activeTab.set(tabId);
    if (tabId === "rounds") await refreshRounds();
    if (tabId === "projects" || tabId === "contribute") await refreshProjects();
  };

  // Caller is responsible for invoking refreshRounds() on mount

  return {
    // Rounds
    rounds,
    selectedRoundId,
    selectedRound,
    isRefreshingRounds,
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
    projectStatusLabel,
    projectStatusClass,
    // Contributions
    contributeForm,
    selectProject,
    // Tab & display
    activeTab,
    appState,
    opStats,
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
    handleAddMatching,
    handleFinalize,
    handleClaimProject,
    handleClaimUnused,
    onTabChange,
  };
}
