<template>
  <ResponsiveLayout
    :desktop-breakpoint="1024"
    class="theme-quadratic-funding"
    :tabs="navTabs"
    :active-tab="activeTab"
    @tab-change="onTabChange"
  >
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <view v-if="activeTab === 'rounds'" class="tab-content">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="roundsStatus" :variant="roundsStatus.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold">{{ roundsStatus.msg }}</text>
      </NeoCard>

      <RoundForm ref="roundFormRef" @create="handleCreateRound" />

      <RoundList
        :rounds="rounds"
        :selected-round-id="selectedRoundId"
        :is-refreshing="isRefreshingRounds"
        :round-status-label="roundStatusLabel"
        :format-amount="formatAmount"
        :format-schedule="formatSchedule"
        :format-address="formatAddress"
        @refresh="refreshRounds"
        @select="selectRound"
      />

      <RoundAdminPanel
        v-if="selectedRound"
        :round="selectedRound"
        :can-manage="canManageSelectedRound"
        :can-finalize="canFinalizeSelectedRound"
        :can-claim-unused="canClaimUnused"
        :is-adding-matching="isAddingMatching"
        :is-finalizing="isFinalizing"
        :is-claiming-unused="isClaimingUnused"
        @add-matching="handleAddMatching"
        @finalize="handleFinalize"
        @claim-unused="handleClaimUnused"
      />
    </view>

    <view v-if="activeTab === 'projects'" class="tab-content">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="projectsStatus" :variant="projectsStatus.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold">{{ projectsStatus.msg }}</text>
      </NeoCard>

      <view v-if="!selectedRound" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <text class="text-sm">{{ t("noSelectedRound") }}</text>
        </NeoCard>
      </view>

      <template v-else>
        <ProjectForm ref="projectFormRef" @register="handleRegisterProject" />

        <ProjectList
          :projects="projects"
          :asset-symbol="selectedRound.assetSymbol"
          :is-refreshing="isRefreshingProjects"
          :claiming-project-id="claimingProjectId"
          :can-claim-project="canClaimProject"
          :format-address="formatAddress"
          :format-amount="formatAmount"
          :project-status-label="projectStatusLabel"
          :project-status-class="projectStatusClass"
          @refresh="refreshProjects"
          @contribute="goToContribute"
          @claim="handleClaimProject"
        />
      </template>
    </view>

    <view v-if="activeTab === 'contribute'" class="tab-content">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <NeoCard v-if="contributionStatus" :variant="contributionStatus.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="font-bold">{{ contributionStatus.msg }}</text>
      </NeoCard>

      <view v-if="!selectedRound" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <text class="text-sm">{{ t("noSelectedRound") }}</text>
        </NeoCard>
      </view>

      <template v-else>
        <NeoCard variant="erobo" class="project-quicklist">
          <text class="section-title">{{ t("tabProjects") }}</text>
          <view v-if="projects.length === 0" class="empty-state">
            <text class="text-xs opacity-70">{{ t("emptyProjects") }}</text>
          </view>
          <view v-else class="chip-row">
            <NeoButton
              v-for="project in projects"
              :key="`chip-${project.id}`"
              size="sm"
              :variant="contributeForm.projectId === project.id ? 'primary' : 'secondary'"
              @click="selectProject(project)"
            >
              {{ project.name || `#${project.id}` }}
            </NeoButton>
          </view>
        </NeoCard>

        <ContributionForm
          ref="contributeFormRef"
          :round-id="selectedRoundId"
          :asset-symbol="selectedRound.assetSymbol"
          @contribute="handleContribute"
        />
      </template>
    </view>

    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="[t('step1'), t('step2'), t('step3'), t('step4')]"
        :features="[
          { name: t('feature1Name'), desc: t('feature1Desc') },
          { name: t('feature2Name'), desc: t('feature2Desc') },
          { name: t('feature3Name'), desc: t('feature3Desc') },
        ]"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { ResponsiveLayout, NeoCard, NeoButton, NeoDoc, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { formatAddress } from "@shared/utils/format";
import RoundForm from "./components/RoundForm.vue";
import RoundList from "./components/RoundList.vue";
import RoundAdminPanel from "./components/RoundAdminPanel.vue";
import ProjectForm from "./components/ProjectForm.vue";
import ProjectList from "./components/ProjectList.vue";
import ContributionForm from "./components/ContributionForm.vue";

const { t } = useI18n();
const activeTab = ref("rounds");

const navTabs = computed<NavTab[]>(() => [
  { id: "rounds", icon: "target", label: t("tabRounds") },
  { id: "projects", icon: "file", label: t("tabProjects") },
  { id: "contribute", icon: "heart", label: t("tabContribute") },
  { id: "docs", icon: "book", label: t("docs") },
]);

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

const {
  isContributing,
  contributeForm,
  selectProject,
  contribute,
  goToContribute,
} = useQuadraticContributions(selectedRound, ensureContractAddress, setStatus, refreshProjects, refreshRounds);

const projectsStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);
const contributionStatus = ref<{ msg: string; type: "success" | "error" } | null>(null);

watch(roundsStatus, (val) => {
  if (activeTab.value === "rounds") roundsStatus.value = val;
});

const roundFormRef = ref<InstanceType<typeof RoundForm> | null>(null);
const projectFormRef = ref<InstanceType<typeof ProjectForm> | null>(null);
const contributeFormRef = ref<InstanceType<typeof ContributionForm> | null>(null);

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
const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) => await finalizeRound(projectIdsRaw, matchedRaw);
const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => await claimProject(project);
const handleClaimUnused = async () => await claimUnused();

const onTabChange = async (tabId: string) => {
  activeTab.value = tabId;
  if (tabId === "rounds") await refreshRounds();
  if (tabId === "projects" || tabId === "contribute") await refreshProjects();
};

const windowWidth = ref(window.innerWidth);
const handleResize = () => { windowWidth.value = window.innerWidth; };

onMounted(async () => {
  window.addEventListener("resize", handleResize);
  await refreshRounds();
});

onUnmounted(() => window.removeEventListener("resize", handleResize));

watch(selectedRoundId, async (roundId) => {
  if (!roundId) return;
  contributeForm.roundId = roundId;
  await refreshProjects();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./quadratic-funding-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--qf-bg-start) 0%, var(--qf-bg-end) 100%);
  color: var(--qf-text);
}

.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
}

.project-quicklist .chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 767px) {
  .tab-content { padding: 12px; }
}

@media (min-width: 1024px) {
  .tab-content { padding: 24px; max-width: 1200px; margin: 0 auto; }
}
</style>
