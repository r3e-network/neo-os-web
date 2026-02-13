<template>
  <view class="page-shell treasury-shell">
    <view class="page-hero fade-up">
      <text class="page-hero-title">{{ t("treasuryTitle") }}</text>
    </view>

    <view class="card fade-up delay-1">
      <view class="card-header">
        <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryAddressTitle')" />
        <text class="section-title">{{ t("treasuryAddressTitle") }}</text>
      </view>
      <view class="address-list">
        <view v-for="address in treasuryAddresses" :key="address" class="address-row">
          <text class="address-text">{{ address }}</text>
          <button class="icon-button" @click="emit('copy', address)">
            <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('copyAlt')" />
          </button>
        </view>
      </view>
    </view>

    <view class="card fade-up delay-2">
      <view class="card-header">
        <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryListTitle')" />
        <text class="section-title">{{ t("treasuryListTitle") }}</text>
      </view>
      <text class="section-subtitle">{{ t("treasuryNep17") }}</text>
      <view class="asset-list">
        <view v-for="asset in treasuryAssets" :key="asset.name" class="asset-row">
          <image class="asset-icon" :src="asset.icon" mode="widthFix" :alt="asset.name" />
          <text class="asset-name">{{ asset.name }}</text>
          <text class="asset-amount">{{ asset.amount }}</text>
        </view>
      </view>
    </view>

    <view class="card fade-up delay-3">
      <view class="card-header">
        <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('treasuryBalanceTitle')" />
        <text class="section-title">{{ t("treasuryBalanceTitle") }}</text>
      </view>
      <view class="chart-placeholder">{{ t("noData") }}</view>
    </view>

    <view class="card fade-up delay-4">
      <view class="card-header">
        <image class="icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('projectCostTitle')" />
        <view class="card-header-text">
          <text class="section-title">{{ t("projectCostTitle") }}</text>
          <text class="section-caption">{{ t("projectCostPeriod") }}</text>
        </view>
      </view>
      <view class="table">
        <view class="table-row table-header">
          <text>{{ t("tableEvent") }}</text>
          <text>{{ t("tableCost") }}</text>
          <text>{{ t("tableTime") }}</text>
        </view>
        <view v-for="row in projectCostRows" :key="row.event" class="table-row">
          <text>{{ row.event }}</text>
          <text>{{ row.cost }}</text>
          <text>{{ row.time }}</text>
        </view>
      </view>
    </view>
  </view>
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
