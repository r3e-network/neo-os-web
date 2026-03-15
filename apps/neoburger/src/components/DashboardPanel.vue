<template>
  <div class="page-shell dashboard-shell">
    <div class="page-hero fade-up">
      <span class="page-hero-title">{{ t("dashboardTitle") }}</span>
    </div>

    <div class="card token-card fade-up delay-1">
      <div class="token-header">
        <img class="token-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('bneoAlt')" />
        <span class="token-title">{{ t("tokenBneo") }}</span>
      </div>
      <div class="token-info">
        <span>{{ t("supplyLabel") }}: {{ totalStakedDisplay }}</span>
        <span>{{ t("holderLabel") }}: {{ t("placeholderDash") }}</span>
        <span>{{ t("contractAddressLabel") }}: {{ t("bneoContractAddressValue") }}</span>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <span class="chart-title">{{ t("bneoTotalSupplyTitle") }}</span>
          <div class="chart-tabs">
            <button class="chart-tab" :class="{ active: supplyRange === '7' }" @click="supplyRange = '7'">
              {{ t("days7") }}
            </button>
            <button class="chart-tab" :class="{ active: supplyRange === '30' }" @click="supplyRange = '30'">
              {{ t("days30") }}
            </button>
          </div>
          <div class="chart-placeholder">{{ t("noData") }}</div>
        </div>
        <div class="chart-card">
          <span class="chart-title">{{ t("dailyGasRewardsPerNeo") }}</span>
          <div class="chart-tabs">
            <button class="chart-tab" :class="{ active: rewardsRange === '7' }" @click="rewardsRange = '7'">
              {{ t("days7") }}
            </button>
            <button class="chart-tab" :class="{ active: rewardsRange === '30' }" @click="rewardsRange = '30'">
              {{ t("days30") }}
            </button>
          </div>
          <div class="chart-placeholder">{{ t("noData") }}</div>
        </div>
      </div>
    </div>

    <div class="card token-card fade-up delay-2">
      <div class="token-header">
        <img class="token-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('nobugAlt')" />
        <span class="token-title">{{ t("tokenNobug") }}</span>
      </div>
      <div class="token-info">
        <span>{{ t("supplyLabel") }}: {{ t("placeholderDash") }}</span>
        <span>{{ t("holderLabel") }}: {{ t("placeholderDash") }}</span>
        <span>{{ t("contractAddressLabel") }}: {{ t("nobugContractAddressValue") }}</span>
      </div>
    </div>

    <div class="card agent-card fade-up delay-3">
      <div class="agent-header">
        <span class="section-title">{{ t("agentInfoTitle") }}</span>
        <div class="agent-right">
          <span class="agent-right-text">{{ t("candidatesWhitelist") }}</span>
          <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('jumpAlt')" />
        </div>
      </div>
      <div class="table">
        <div class="table-row table-header">
          <span>{{ t("voteTarget") }}</span>
          <span>{{ t("votesTotal") }}</span>
          <span>{{ t("scriptHash") }}</span>
        </div>
        <div class="table-row empty-row">
          <span class="empty-text">{{ t("noData") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

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
