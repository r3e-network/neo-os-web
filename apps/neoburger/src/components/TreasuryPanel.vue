<template>
  <div class="page-shell treasury-shell">
    <div class="page-hero fade-up">
      <span class="page-hero-title">{{ t("treasuryTitle") }}</span>
    </div>

    <div class="card fade-up delay-1">
      <div class="card-header">
        <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryAddressTitle')" />
        <span class="section-title">{{ t("treasuryAddressTitle") }}</span>
      </div>
      <div class="address-list">
        <div v-for="address in treasuryAddresses" :key="address" class="address-row">
          <span class="address-text">{{ address }}</span>
          <button class="icon-button" @click="emit('copy', address)">
            <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('copyAlt')" />
          </button>
        </div>
      </div>
    </div>

    <div class="card fade-up delay-2">
      <div class="card-header">
        <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryListTitle')" />
        <span class="section-title">{{ t("treasuryListTitle") }}</span>
      </div>
      <span class="section-subtitle">{{ t("treasuryNep17") }}</span>
      <div class="asset-list">
        <div v-for="asset in treasuryAssets" :key="asset.name" class="asset-row">
          <img class="asset-icon" :src="asset.icon" mode="widthFix" :alt="asset.name" />
          <span class="asset-name">{{ asset.name }}</span>
          <span class="asset-amount">{{ asset.amount }}</span>
        </div>
      </div>
    </div>

    <div class="card fade-up delay-3">
      <div class="card-header">
        <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryBalanceTitle')" />
        <span class="section-title">{{ t("treasuryBalanceTitle") }}</span>
      </div>
      <div class="chart-placeholder">{{ t("noData") }}</div>
    </div>

    <div class="card fade-up delay-4">
      <div class="card-header">
        <img class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('projectCostTitle')" />
        <div class="card-header-text">
          <span class="section-title">{{ t("projectCostTitle") }}</span>
          <span class="section-caption">{{ t("projectCostPeriod") }}</span>
        </div>
      </div>
      <div class="table">
        <div class="table-row table-header">
          <span>{{ t("tableEvent") }}</span>
          <span>{{ t("tableCost") }}</span>
          <span>{{ t("tableTime") }}</span>
        </div>
        <div v-for="row in projectCostRows" :key="row.event" class="table-row">
          <span>{{ row.event }}</span>
          <span>{{ row.cost }}</span>
          <span>{{ row.time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "copy", value: string): void;
}>();

const treasuryAddresses = computed(() => [t("treasuryAddress1"), t("treasuryAddress2")]);

const treasuryAssets = computed(() => [
  { icon: "/static/neoburger-bneo-logo.svg", name: t("tokenBneo"), amount: t("placeholderDash") },
  { icon: "/static/neoburger-gas-logo.svg", name: t("tokenGas"), amount: t("placeholderDash") },
  { icon: "/static/neoburger-nobug-token.svg", name: t("tokenNobug"), amount: t("placeholderDash") },
]);

const projectCostRows = computed(() => [
  {
    event: t("projectCostEventBurgerNeoDeployment"),
    cost: t("projectCostCostBurgerNeoDeployment"),
    time: t("projectCostTimeBurgerNeoDeployment"),
  },
  {
    event: t("projectCostEventBurgerAgentDeployment"),
    cost: t("projectCostCostBurgerAgentDeployment"),
    time: t("projectCostTimeBurgerAgentDeployment"),
  },
  {
    event: t("projectCostEventDailyMaintenance"),
    cost: t("projectCostCostDailyMaintenance"),
    time: t("projectCostTimeDailyMaintenance"),
  },
  {
    event: t("projectCostEventBurgerNeoUpgrade"),
    cost: t("projectCostCostBurgerNeoUpgrade"),
    time: t("projectCostTimeBurgerNeoUpgrade"),
  },
  {
    event: t("projectCostEventNobugDeployment"),
    cost: t("projectCostCostNobugDeployment"),
    time: t("projectCostTimeNobugDeployment"),
  },
]);
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

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.icon {
  width: 18px;
}

.section-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-subtitle {
  font-size: 13px;
  font-weight: 700;
}

.section-caption {
  font-size: 11px;
  color: var(--burger-text-muted);
}

.address-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.address-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--burger-surface-alt);
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--burger-border);
}

.address-text {
  font-size: 12px;
  font-weight: 600;
  word-break: break-all;
}

.icon-button {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asset-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--burger-border);
  background: var(--burger-surface-soft);
}

.asset-icon {
  width: 20px;
}

.asset-name {
  font-size: 13px;
  font-weight: 700;
}

.asset-amount {
  font-size: 12px;
  color: var(--burger-text-soft);
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

.delay-4 {
  animation-delay: 0.4s;
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
</style>
