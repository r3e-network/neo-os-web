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
      <div class="hero-container">
        <span class="hero-label">{{ t("appName") }}</span>
        <div class="hero-progress-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#qfRingGrad)"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="ringOffset"
              transform="rotate(-90 60 60)"
              class="ring-progress"
            />
            <defs>
              <linearGradient id="qfRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f472b6" />
                <stop offset="100%" stop-color="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <div class="ring-center">
            <span class="ring-value">{{ roundProgressPct }}%</span>
            <span class="ring-sub">{{ t("tabRounds") }}</span>
          </div>
        </div>
        <div class="hero-stats-row">
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("sidebarMatchingPool") }}</span>
            <span class="hero-stat-value">{{ matchingPoolDisplay }}</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-label">{{ t("tabProjects") }}</span>
            <span class="hero-stat-value">{{ projects.length }}</span>
          </div>
        </div>
      </div>

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
        <span class="font-bold">{{ projectsStatus.msg }}</span>
      </NeoCard>

      <div v-if="!selectedRound" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <span class="text-sm">{{ t("noSelectedRound") }}</span>
        </NeoCard>
      </div>

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
        <span class="font-bold">{{ contributionStatus.msg }}</span>
      </NeoCard>

      <div v-if="!selectedRound" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <span class="text-sm">{{ t("noSelectedRound") }}</span>
        </NeoCard>
      </div>

      <template v-else>
        <NeoCard variant="erobo" class="project-quicklist">
          <span class="section-title">{{ t("tabProjects") }}</span>
          <div v-if="projects.length === 0" class="empty-state">
            <span class="text-xs opacity-70">{{ t("emptyProjects") }}</span>
          </div>
          <div v-else class="chip-row">
            <NeoButton
              v-for="project in projects"
              :key="`chip-${project.id}`"
              size="sm"
              :variant="contributeForm.projectId === project.id ? 'primary' : 'secondary'"
              @click="selectProject(project)"
            >
              {{ project.name || `#${project.id}` }}
            </NeoButton>
          </div>
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
        <NeoButton size="sm" variant="primary" class="op-btn" type="button" @click="onTabChange('contribute')">
          {{ t("tabContribute") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed } from "vue";
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
    { labelKey: "sidebarSelectedRound", value: () => selectedRoundId.value ?? t("notAvailable") },
    {
      labelKey: "sidebarMatchingPool",
      value: () => (selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : t("notAvailable")),
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

const RING_R = 52;
const ringCircumference = 2 * Math.PI * RING_R;

const activeRounds = computed(() => rounds.value.filter((r: { status?: string }) => r.status === "active").length);
const roundProgressPct = computed(() => {
  const total = rounds.value.length;
  if (total === 0) return 0;
  return Math.round((activeRounds.value / total) * 100);
});
const ringOffset = computed(() => ringCircumference - (roundProgressPct.value / 100) * ringCircumference);
const matchingPoolDisplay = computed(() =>
  selectedRound.value ? formatAmount(selectedRound.value.matchingPool) : t("notAvailable"),
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./quadratic-funding-theme.scss" as *;

:global(body) {
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

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  background: linear-gradient(180deg, rgba(236, 72, 153, 0.06) 0%, transparent 100%);
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-progress-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

.ring-progress {
  transition: stroke-dashoffset 0.8s ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-value {
  font-size: 24px;
  font-weight: 700;
}

.ring-sub {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--bg-card-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
}

/* ── Quadratic Funding Hero Enhancements ── */
@keyframes qf-sprout-grow {
  0% {
    transform: scaleY(0.7) translateY(4px);
    opacity: 0.6;
  }
  50% {
    transform: scaleY(1.05) translateY(-2px);
    opacity: 1;
  }
  100% {
    transform: scaleY(1) translateY(0);
    opacity: 0.9;
  }
}

@keyframes qf-funding-circle-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3);
  }
  50% {
    box-shadow:
      0 0 0 12px rgba(16, 185, 129, 0),
      0 0 24px rgba(16, 185, 129, 0.15);
  }
}

@keyframes qf-emerald-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes qf-ring-glow {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgba(236, 72, 153, 0.2));
  }
  50% {
    filter: drop-shadow(0 0 16px rgba(236, 72, 153, 0.4));
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05), rgba(236, 72, 153, 0.06));
  background-size: 200% 200%;
  animation: qf-emerald-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(16, 185, 129, 0.08),
    inset 0 1px 0 rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.1);
}

.hero-label {
  animation: qf-sprout-grow 4s ease-in-out infinite;
  transform-origin: bottom center;
}

.hero-progress-ring {
  animation: qf-funding-circle-pulse 3s ease-in-out infinite;
  border-radius: 50%;
}

.ring-svg {
  animation: qf-ring-glow 3s ease-in-out infinite;
}

.hero-stats-row {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.08);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(255, 255, 255, 0.02));
}
</style>
