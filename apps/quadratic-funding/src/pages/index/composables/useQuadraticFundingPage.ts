import { ref, computed, onMounted, watch } from "vue";
import type { StatsDisplayItem } from "@shared/components";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { formatAddress } from "@shared/utils/format";
import type RoundForm from "../components/RoundForm.vue";
import type ProjectForm from "../components/ProjectForm.vue";
import type ContributionForm from "../components/ContributionForm.vue";

export function useQuadraticFundingPage(t: (key: string) => string) {
  const activeTab = ref("rounds");

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
  const appState = computed(() => ({
    roundCount: rounds.value.length,
    selectedRoundId: selectedRoundId.value,
  }));

  const opStats = computed<StatsDisplayItem[]>(() => [
    { label: t("tabRounds"), value: rounds.value.length },
    { label: t("tabProjects"), value: projects.value.length },
    { label: t("sidebarSelectedRound"), value: selectedRoundId.value ?? "—" },
    {
      label: t("sidebarMatchingPool"),
      value: selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : "—",
    },
  ]);

  // Status refs for sub-tabs
  const projectsStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);
  const contributionStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);

  // Form refs
  const roundFormRef = ref<InstanceType<typeof RoundForm> | null>(null);
  const projectFormRef = ref<InstanceType<typeof ProjectForm> | null>(null);
  const contributeFormRef = ref<InstanceType<typeof ContributionForm> | null>(null);

  // Form handlers
  const handleCreateRound = async (data: Parameters<typeof createRound>[0]) => {
    roundFormRef.value?.setLoading(true);
    await createRound(data);
    roundFormRef.value?.setLoading(false);
    if (roundsStatus.value?.type === "success") roundFormRef.value?.reset();
  };

  const handleRegisterProject = async (data: Parameters<typeof registerProject>[0]) => {
    projectFormRef.value?.setLoading(true);
    await registerProject(data);
    projectFormRef.value?.setLoading(false);
    if (!roundsStatus.value || roundsStatus.value.type === "success") projectFormRef.value?.reset();
  };

  const handleContribute = async (data: Parameters<typeof contribute>[0]) => {
    contributeFormRef.value?.setLoading(true);
    await contribute(data);
    contributeFormRef.value?.setLoading(false);
    if (!roundsStatus.value || roundsStatus.value.type === "success") contributeFormRef.value?.reset();
  };

  const handleAddMatching = async (amount: string) => await addMatching(amount);
  const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) =>
    await finalizeRound(projectIdsRaw, matchedRaw);
  const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => await claimProject(project);
  const handleClaimUnused = async () => await claimUnused();

  const onTabChange = async (tabId: string) => {
    activeTab.value = tabId;
    if (tabId === "rounds") await refreshRounds();
    if (tabId === "projects" || tabId === "contribute") await refreshProjects();
  };

  // Lifecycle
  onMounted(async () => {
    await refreshRounds();
  });

  watch(selectedRoundId, async (roundId) => {
    if (!roundId) return;
    contributeForm.roundId = roundId;
    await refreshProjects();
  });

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
