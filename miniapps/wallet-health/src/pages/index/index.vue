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
      <RiskAlerts
        :is-unsupported="isUnsupported"
        :status="status"
        :risk-label="riskLabel"
        :risk-class="riskClass"
        :risk-icon="riskIcon"
        @switch-chain="switchToAppChain"
      />

      <view v-if="!address" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <text class="mb-3 block text-sm">{{ t("walletNotConnected") }}</text>
          <NeoButton size="sm" variant="primary" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </view>

      <view v-else class="health-stack">
        <HealthDashboard
          :stats="healthStats"
          :neo-display="neoDisplay"
          :gas-display="gasDisplay"
          :is-refreshing="isRefreshing"
          @refresh="refreshBalances"
        />
        <Recommendations :recommendations="recommendations" />
      </view>
    </template>

    <template #tab-checklist>
      <NeoCard variant="erobo-neo" class="score-card">
        <view class="score-header">
          <text class="section-title">{{ t("sectionChecklist") }}</text>
          <text class="score-value">{{ safetyScore }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: `${safetyScore}%` }" />
        </view>
      </NeoCard>

      <NeoCard variant="erobo" class="checklist-card">
        <view v-for="item in checklistItems" :key="item.id" class="checklist-item">
          <view class="checklist-content">
            <text class="checklist-title">{{ item.title }}</text>
            <text class="checklist-desc">{{ item.desc }}</text>
          </view>
          <NeoButton
            size="sm"
            :variant="item.done ? 'primary' : 'secondary'"
            :disabled="item.auto"
            @click="toggleChecklist(item.id)"
          >
            <AppIcon :name="item.done ? 'check' : 'x'" :size="14" />
            <text class="checklist-action">
              {{ item.auto ? t("autoChecked") : item.done ? t("markUndo") : t("markDone") }}
            </text>
          </NeoButton>
        </view>
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
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
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

const opStats = computed<StatsDisplayItem[]>(() => [
  { label: t("statConnection"), value: address.value ? t("statusConnected") : t("statusDisconnected") },
  { label: t("statNeo"), value: neoDisplay.value },
  { label: t("statGas"), value: gasDisplay.value },
  { label: t("statScore"), value: `${safetyScore.value}%` },
]);

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
    await refreshBalances();
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
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./wallet-health-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--health-bg-start) 0%, var(--health-bg-end) 100%);
  color: var(--health-text);
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
</style>
