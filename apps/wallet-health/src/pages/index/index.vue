<template>
  <MiniAppPage
    name="wallet-health"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="onTabChange"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="accent" compact>
          <template #background>
            <div class="health-gauge-scene" aria-hidden="true">
              <div class="gauge-ring" :style="{ '--score': safetyScore }">
                <span class="gauge-value" :class="riskClass">{{ safetyScore }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <RiskAlerts
        :is-unsupported="isUnsupported"
        :status="status"
        :risk-label="riskLabel"
        :risk-class="riskClass"
        :risk-icon="riskIcon"
        @switch-chain="switchToAppChain"
      />

      <div v-if="!address" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
          <NeoButton size="sm" variant="primary" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </div>

      <div v-else class="health-stack">
        <HealthDashboard
          :stats="healthStats"
          :neo-display="neoDisplay"
          :gas-display="gasDisplay"
          :is-refreshing="isRefreshing"
          @refresh="refreshBalances"
        />
        <Recommendations :recommendations="recommendations" />
      </div>
    </template>

    <template #tab-checklist>
      <NeoCard variant="erobo-neo" class="score-card">
        <div class="score-header">
          <span class="section-title">{{ t("sectionChecklist") }}</span>
          <span class="score-value">{{ safetyScore }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${safetyScore}%` }" />
        </div>
      </NeoCard>

      <NeoCard variant="erobo" class="checklist-card">
        <div v-for="item in checklistItems" :key="item.id" class="checklist-item">
          <div class="checklist-content">
            <span class="checklist-title">{{ item.title }}</span>
            <span class="checklist-desc">{{ item.desc }}</span>
          </div>
          <NeoButton
            size="sm"
            :variant="item.done ? 'primary' : 'secondary'"
            :disabled="item.auto"
            @click="toggleChecklist(item.id)"
          >
            <AppIcon :name="item.done ? 'check' : 'x'" :size="14" />
            <span class="checklist-action">
              {{ item.auto ? t("autoChecked") : item.done ? t("markUndo") : t("markDone") }}
            </span>
          </NeoButton>
        </div>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('healthSummary')">
        <NeoButton v-if="!address" size="sm" variant="primary" class="op-btn" @click="connectWallet">
          {{ t("connectWallet") }}
        </NeoButton>
        <NeoButton v-else size="sm" variant="primary" class="op-btn" :disabled="isRefreshing" @click="refreshBalances">
          {{ isRefreshing ? t("loading") : t("refresh") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { MiniAppPage, NeoCard, NeoButton, HeroSection } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useWalletAnalysis } from "@/composables/useWalletAnalysis";
import { useHealthScore } from "@/composables/useHealthScore";
import HealthDashboard from "./components/HealthDashboard.vue";
import RiskAlerts from "./components/RiskAlerts.vue";
import Recommendations from "./components/Recommendations.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "wallet-health",
  messages,
  template: {
    tabs: [
      { key: "health", labelKey: "tabHealth", icon: "shield", default: true },
      { key: "checklist", labelKey: "tabChecklist", icon: "check" },
    ],
    docSubtitleKey: "docsSubtitle",
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "statConnection", value: () => (address.value ? t("statusConnected") : t("statusDisconnected")) },
    { labelKey: "statNetwork", value: () => chainLabel.value },
    { labelKey: "statNeo", value: () => neoDisplay.value },
    { labelKey: "statGas", value: () => gasDisplay.value },
    { labelKey: "statScore", value: () => `${safetyScore.value}%` },
  ],
});

const {
  address,
  status,
  isRefreshing,
  isUnsupported,
  neoDisplay,
  gasDisplay,
  chainLabel,
  chainVariant,
  gasOk,
  switchToAppChain,
  refreshBalances,
  connectWallet,
} = useWalletAnalysis();

const { checklistItems, safetyScore, riskLabel, riskClass, riskIcon, recommendations, loadChecklist, toggleChecklist } =
  useHealthScore(gasOk);

const appState = computed(() => ({
  connectionStatus: address.value ? t("statusConnected") : t("statusDisconnected"),
  networkLabel: chainLabel.value,
  neoBalance: neoDisplay.value,
  gasBalance: gasDisplay.value,
  safetyScore: safetyScore.value,
}));
const healthStats = computed(() => [
  {
    label: t("statConnection"),
    value: address.value ? t("statusConnected") : t("statusDisconnected"),
    variant: address.value ? "success" : "danger",
  },
  { label: t("statNetwork"), value: chainLabel.value, variant: chainVariant.value },
  { label: t("statNeo"), value: neoDisplay.value, variant: "erobo-neo" },
  { label: t("statGas"), value: gasDisplay.value, variant: gasOk.value ? "success" : "warning" },
  {
    label: t("statScore"),
    value: `${safetyScore.value}%`,
    variant: safetyScore.value >= 80 ? "success" : safetyScore.value >= 50 ? "warning" : "danger",
  },
]);

const onTabChange = async (tabId: string) => {
  if (tabId === "health") {
    try {
      await refreshBalances();
    } catch (_e: unknown) {
      /* non-critical: tab change handler */
    }
  }
};

onMounted(() => {
  loadChecklist();
});

const resetAndReload = async () => {
  await refreshBalances();
  loadChecklist();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./wallet-health-theme.scss" as *;

:global(body) {
  background: linear-gradient(135deg, var(--health-bg-start) 0%, var(--health-bg-end) 100%);
  color: var(--health-text);
}

.hero-container {
  margin-bottom: 20px;
}

.health-gauge-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

.gauge-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(var(--health-accent, #00e599) calc(var(--score, 0) * 1%), rgba(255, 255, 255, 0.08) 0);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: var(--health-bg-start, #0d0f14);
  }
}

.gauge-value {
  position: relative;
  z-index: 1;
  font-size: 22px;
  font-weight: 900;
  color: var(--health-accent-strong, #00e599);
}

.op-btn {
  width: 100%;
}

.health-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--health-accent-strong);
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--health-accent), var(--health-accent-strong));
}

.checklist-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.checklist-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: var(--bg-card-subtle, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.checklist-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.checklist-title {
  font-size: 14px;
  font-weight: 700;
}

.checklist-desc {
  font-size: 11px;
  color: var(--health-muted);
  line-height: 1.4;
}

.checklist-action {
  margin-left: 6px;
  font-size: 11px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  text-align: center;
}

@media (max-width: 767px) {
  .section-title {
    font-size: 16px;
  }
  .checklist-item {
    flex-direction: column;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .gauge-ring {
    width: 64px;
    height: 64px;
  }

  .gauge-ring::before {
    width: 50px;
    height: 50px;
  }

  .gauge-value {
    font-size: 18px;
  }

  .health-gauge-scene {
    height: 80px;
  }

  .hero-envelope-stats {
    padding: 12px 16px;
  }

  .hero-stat-value {
    font-size: 18px;
  }
}

/* ── Wallet Health Hero Enhancements: Health Dashboard ── */
@keyframes heartbeat-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.08);
  }
  28% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.12);
  }
  56% {
    transform: scale(1);
  }
}
@keyframes vitals-sweep {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 40%, var(--health-accent-soft, rgba(0, 229, 153, 0.08)) 0%, transparent 55%);
}
.gauge-ring {
  animation: heartbeat-pulse 2.5s ease-in-out infinite;
  box-shadow: 0 0 20px var(--health-accent-glow, rgba(0, 229, 153, 0.15));
}
.gauge-value {
  text-shadow: 0 0 12px var(--health-accent-glow-strong, rgba(0, 229, 153, 0.4));
}
.progress-fill {
  background: linear-gradient(90deg, var(--health-accent), var(--health-accent-strong), var(--health-accent));
  background-size: 200% 100%;
  animation: vitals-sweep 3s linear infinite;
  box-shadow: 0 0 8px var(--health-accent-glow, rgba(0, 229, 153, 0.3));
}
.health-stack {
  transition: opacity 0.3s ease;
}
.score-card {
  box-shadow: 0 4px 20px var(--health-accent-soft, rgba(0, 229, 153, 0.1));
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px var(--health-accent-soft-strong, rgba(0, 229, 153, 0.25));
    transform: translateY(-2px);
  }
}
.checklist-item {
  background: linear-gradient(180deg, var(--bg-card-subtle, rgba(255, 255, 255, 0.04)), transparent);
}
</style>
