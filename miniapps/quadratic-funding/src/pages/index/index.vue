<template>
  <view class="theme-quadratic-funding">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="roundsStatus"
      @tab-change="onTabChange"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Rounds Tab (default) -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <!-- Projects Tab -->
      <template #tab-projects>
        <NeoCard
          v-if="projectsStatus"
          :variant="projectsStatus.type === 'error' ? 'danger' : 'success'"
          class="mb-4 text-center"
        >
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
      </template>

      <!-- Contribute Tab -->
      <template #tab-contribute>
        <NeoCard
          v-if="contributionStatus"
          :variant="contributionStatus.type === 'error' ? 'danger' : 'success'"
          class="mb-4 text-center"
        >
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
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('quickContribute')">
          <NeoStats :stats="opStats" />
          <NeoButton size="sm" variant="primary" class="op-btn" @click="onTabChange('contribute')">
            {{ t("tabContribute") }}
          </NeoButton>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { useQuadraticRounds } from "@/composables/useQuadraticRounds";
import { useQuadraticProjects } from "@/composables/useQuadraticProjects";
import { useQuadraticContributions } from "@/composables/useQuadraticContributions";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, ErrorBoundary, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { formatAddress } from "@shared/utils/format";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import RoundForm from "./components/RoundForm.vue";
import RoundList from "./components/RoundList.vue";
import RoundAdminPanel from "./components/RoundAdminPanel.vue";
import ProjectForm from "./components/ProjectForm.vue";
import ProjectList from "./components/ProjectList.vue";
import ContributionForm from "./components/ContributionForm.vue";

const { t } = useI18n();
const activeTab = ref("rounds");

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "rounds", labelKey: "tabRounds", icon: "🎯", default: true },
    { key: "projects", labelKey: "tabProjects", icon: "📁" },
    { key: "contribute", labelKey: "tabContribute", icon: "❤️" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};

const appState = computed(() => ({
  roundCount: rounds.value.length,
  selectedRoundId: selectedRoundId.value,
}));

const sidebarItems = computed(() => [
  { label: t("tabRounds"), value: rounds.value.length },
  { label: t("tabProjects"), value: projects.value.length },
  { label: t("sidebarSelectedRound"), value: selectedRoundId.value ?? "—" },
  {
    label: t("sidebarMatchingPool"),
    value: selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : "—",
  },
]);

const opStats = computed(() => [
  { label: t("tabRounds"), value: rounds.value.length },
  { label: t("tabProjects"), value: projects.value.length },
  { label: t("sidebarSelectedRound"), value: selectedRoundId.value ?? "—" },
  {
    label: t("sidebarMatchingPool"),
    value: selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : "—",
  },
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

const { isContributing, contributeForm, selectProject, contribute, goToContribute } = useQuadraticContributions(
  selectedRound,
  ensureContractAddress,
  setStatus,
  refreshProjects,
  refreshRounds
);

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
const handleFinalize = async (projectIdsRaw: string, matchedRaw: string) =>
  await finalizeRound(projectIdsRaw, matchedRaw);
const handleClaimProject = async (project: Parameters<typeof claimProject>[0]) => await claimProject(project);
const handleClaimUnused = async () => await claimUnused();

const { handleBoundaryError } = useHandleBoundaryError("quadratic-funding");
const resetAndReload = async () => {
  await refreshRounds();
};

const onTabChange = async (tabId: string) => {
  activeTab.value = tabId;
  if (tabId === "rounds") await refreshRounds();
  if (tabId === "projects" || tabId === "contribute") await refreshProjects();
};

onMounted(async () => {
  await refreshRounds();
});

watch(selectedRoundId, async (roundId) => {
  if (!roundId) return;
  contributeForm.roundId = roundId;
  await refreshProjects();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./quadratic-funding-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--qf-bg-start) 0%, var(--qf-bg-end) 100%);
  color: var(--qf-text);
}

.op-btn {
  width: 100%;
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
</style>
