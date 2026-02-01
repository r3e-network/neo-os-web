<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-wallet-health" :tabs="navTabs" :active-tab="activeTab" @tab-change="onTabChange">
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <view v-if="activeTab === 'health'" class="tab-content">
      <RiskAlerts
        :is-unsupported="isUnsupported"
        :status="status"
        :risk-label="riskLabel"
        :risk-class="riskClass"
        :risk-icon="riskIcon"
        :t="t"
        @switch-chain="switchToAppChain"
      />

      <view v-if="!address" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <text class="text-sm block mb-3">{{ t("walletNotConnected") }}</text>
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
          :t="t"
          @refresh="refreshBalances"
        />
        <Recommendations :recommendations="recommendations" :t="t" />
      </view>
    </view>

    <view v-if="activeTab === 'checklist'" class="tab-content">
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
    </view>

    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docsSubtitle')"
        :description="t('docsDescription')"
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
import { ref, computed, onMounted } from "vue";
import { ResponsiveLayout, NeoCard, NeoButton, NeoDoc, AppIcon } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import { useI18n } from "@/composables/useI18n";
import { useWalletAnalysis } from "@/composables/useWalletAnalysis";
import { useHealthScore } from "@/composables/useHealthScore";
import HealthDashboard from "./components/HealthDashboard.vue";
import RiskAlerts from "./components/RiskAlerts.vue";
import Recommendations from "./components/Recommendations.vue";

const { t } = useI18n();
const activeTab = ref("health");
const navTabs = computed<NavTab[]>(() => [
  { id: "health", icon: "shield", label: t("tabHealth") },
  { id: "checklist", icon: "check", label: t("tabChecklist") },
  { id: "docs", icon: "book", label: t("docs") },
]);

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

const {
  checklistItems,
  safetyScore,
  riskLabel,
  riskClass,
  riskIcon,
  recommendations,
  loadChecklist,
  toggleChecklist,
} = useHealthScore(gasOk);

const healthStats = computed(() => [
  { label: t("statConnection"), value: address.value ? t("statusConnected") : t("statusDisconnected"), variant: address.value ? "success" : "danger" },
  { label: t("statNetwork"), value: chainLabel.value, variant: chainVariant.value },
  { label: t("statNeo"), value: neoDisplay.value, variant: "erobo-neo" },
  { label: t("statGas"), value: gasDisplay.value, variant: gasOk.value ? "success" : "warning" },
  { label: t("statScore"), value: `${safetyScore.value}%`, variant: safetyScore.value >= 80 ? "success" : safetyScore.value >= 50 ? "warning" : "danger" },
]);

const onTabChange = async (tabId: string) => {
  activeTab.value = tabId;
  if (tabId === "health") {
    await refreshBalances();
  }
};

onMounted(() => {
  loadChecklist();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./wallet-health-theme.scss";

:global(page) {
  background: linear-gradient(135deg, var(--health-bg-start) 0%, var(--health-bg-end) 100%);
  color: var(--health-text);
}

.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background: rgba(255, 255, 255, 0.08);
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  .tab-content {
    padding: 12px;
    gap: 12px;
  }
  .section-title {
    font-size: 16px;
  }
  .checklist-item {
    flex-direction: column;
    gap: 12px;
  }
}

@media (min-width: 1024px) {
  .tab-content {
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }
  .health-stack {
    gap: 20px;
  }
}
</style>
