<template>
  <view class="page-shell dashboard-shell">
    <view class="page-hero fade-up">
      <text class="page-hero-title">{{ t("dashboardTitle") }}</text>
    </view>

    <view class="card token-card fade-up delay-1">
      <view class="token-header">
        <image class="token-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('bneoAlt')" />
        <text class="token-title">{{ t("tokenBneo") }}</text>
      </view>
      <view class="token-info">
        <text>{{ t("supplyLabel") }}: {{ totalStakedDisplay }}</text>
        <text>{{ t("holderLabel") }}: {{ t("placeholderDash") }}</text>
        <text>{{ t("contractAddressLabel") }}: {{ t("bneoContractAddressValue") }}</text>
      </view>
      <view class="chart-grid">
        <view class="chart-card">
          <text class="chart-title">{{ t("bneoTotalSupplyTitle") }}</text>
          <view class="chart-tabs">
            <button class="chart-tab" :class="{ active: supplyRange === '7' }" @click="supplyRange = '7'">
              {{ t("days7") }}
            </button>
            <button class="chart-tab" :class="{ active: supplyRange === '30' }" @click="supplyRange = '30'">
              {{ t("days30") }}
            </button>
          </view>
          <view class="chart-placeholder">{{ t("noData") }}</view>
        </view>
        <view class="chart-card">
          <text class="chart-title">{{ t("dailyGasRewardsPerNeo") }}</text>
          <view class="chart-tabs">
            <button class="chart-tab" :class="{ active: rewardsRange === '7' }" @click="rewardsRange = '7'">
              {{ t("days7") }}
            </button>
            <button class="chart-tab" :class="{ active: rewardsRange === '30' }" @click="rewardsRange = '30'">
              {{ t("days30") }}
            </button>
          </view>
          <view class="chart-placeholder">{{ t("noData") }}</view>
        </view>
      </view>
    </view>

    <view class="card token-card fade-up delay-2">
      <view class="token-header">
        <image class="token-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('nobugAlt')" />
        <text class="token-title">{{ t("tokenNobug") }}</text>
      </view>
      <view class="token-info">
        <text>{{ t("supplyLabel") }}: {{ t("placeholderDash") }}</text>
        <text>{{ t("holderLabel") }}: {{ t("placeholderDash") }}</text>
        <text>{{ t("contractAddressLabel") }}: {{ t("nobugContractAddressValue") }}</text>
      </view>
    </view>

    <view class="card agent-card fade-up delay-3">
      <view class="agent-header">
        <text class="section-title">{{ t("agentInfoTitle") }}</text>
        <view class="agent-right">
          <text class="agent-right-text">{{ t("candidatesWhitelist") }}</text>
          <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('jumpAlt')" />
        </view>
      </view>
      <view class="table">
        <view class="table-row table-header">
          <text>{{ t("voteTarget") }}</text>
          <text>{{ t("votesTotal") }}</text>
          <text>{{ t("scriptHash") }}</text>
        </view>
        <view class="table-row empty-row">
          <text class="empty-text">{{ t("noData") }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

defineProps<{
  totalStakedDisplay: string;
}>();

const supplyRange = ref<"7" | "30">("7");
const rewardsRange = ref<"7" | "30">("7");
</script>

<style lang="scss" scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-hero {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-hero-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 32px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card {
  background: var(--burger-surface);
  border-radius: 20px;
  padding: 18px;
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.token-card {
  background: var(--burger-surface-alt);
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.token-icon {
  width: 22px;
}

.token-title {
  font-size: 18px;
  font-weight: 800;
}

.token-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--burger-text-soft);
}

.chart-grid {
  display: grid;
  gap: 12px;
}

.chart-card {
  background: var(--burger-surface-soft);
  border-radius: 16px;
  padding: 12px;
  border: 1px solid var(--burger-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-title {
  font-size: 13px;
  font-weight: 700;
}

.chart-tabs {
  display: flex;
  gap: 8px;
}

.chart-tab {
  border: 1px solid var(--burger-border);
  background: var(--burger-surface);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--burger-text-muted);
}

.chart-tab.active {
  background: var(--burger-accent);
  color: var(--burger-accent-text);
  border-color: transparent;
}

.chart-placeholder {
  height: 140px;
  border-radius: 16px;
  border: 1px dashed var(--burger-border-dashed);
  display: grid;
  place-items: center;
  color: var(--burger-chart-placeholder-text);
  background: var(--burger-surface-soft);
}

.agent-card {
  gap: 14px;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.agent-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--burger-text-muted);
}

.icon {
  width: 18px;
}

.table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 1.4fr 0.6fr 0.8fr;
  gap: 8px;
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--burger-border);
  background: var(--burger-surface-soft);
}

.table-header {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  background: var(--burger-surface-warm);
}

.empty-row {
  grid-template-columns: 1fr;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: var(--burger-text-muted);
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

.delay-1 {
  animation-delay: 0.1s;
}

.delay-2 {
  animation-delay: 0.2s;
}

.delay-3 {
  animation-delay: 0.3s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 768px) {
  .chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
