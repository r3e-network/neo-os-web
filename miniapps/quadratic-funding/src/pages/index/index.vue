<template>
  <MiniAppPage
    name="quadratic-funding"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="roundsStatus"
    @tab-change="onTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="refreshRounds"
  >
    <!-- Rounds Tab (default) -->
    <template #content>
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
        <NeoButton size="sm" variant="primary" class="op-btn" @click="onTabChange('contribute')">
          {{ t("tabContribute") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import RoundForm from "./components/RoundForm.vue";
import RoundList from "./components/RoundList.vue";
import RoundAdminPanel from "./components/RoundAdminPanel.vue";
import { useQuadraticFundingPage } from "./composables/useQuadraticFundingPage";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "quadratic-funding",
  messages,
  template: {
    tabs: [
      { key: "rounds", labelKey: "tabRounds", icon: "🎯", default: true },
      { key: "projects", labelKey: "tabProjects", icon: "📁" },
      { key: "contribute", labelKey: "tabContribute", icon: "❤️" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "tabRounds", value: () => rounds.value.length },
    { labelKey: "tabProjects", value: () => projects.value.length },
    { labelKey: "sidebarSelectedRound", value: () => selectedRoundId.value ?? "—" },
    {
      labelKey: "sidebarMatchingPool",
      value: () => (selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : "—"),
    },
  ],
});

const {
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
  projects,
  isRefreshingProjects,
  claimingProjectId,
  canClaimProject,
  projectStatusLabel,
  projectStatusClass,
  contributeForm,
  selectProject,
  activeTab,
  appState,
  opStats,
  projectsStatus,
  contributionStatus,
  roundFormRef,
  projectFormRef,
  contributeFormRef,
  handleCreateRound,
  handleRegisterProject,
  handleContribute,
  handleAddMatching,
  handleFinalize,
  handleClaimProject,
  handleClaimUnused,
  onTabChange,
} = useQuadraticFundingPage(t);
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
