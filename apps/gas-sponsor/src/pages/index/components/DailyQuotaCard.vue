<template>
  <NeoCard>
    <div class="quota-display">
      <div class="quota-header">
        <span class="quota-title">{{ t("todayUsage") }}</span>
        <span class="quota-percent">{{ Math.round(quotaPercent) }}%</span>
      </div>
      <div class="quota-bar-container">
        <div class="quota-fill" :style="{ width: quotaPercent + '%' }"></div>
      </div>
      <div class="quota-markers">
        <span class="marker">0</span>
        <span class="marker">{{ formatBalance(dailyLimit) }}</span>
      </div>
      <span class="quota-text"> {{ formatBalance(usedQuota) }} / {{ formatBalance(dailyLimit) }} GAS </span>
    </div>

    <div class="info-row">
      <span class="info-label">{{ t("remainingToday") }}</span>
      <span class="info-value highlight">{{ formatBalance(remainingQuota) }} GAS</span>
    </div>
    <div class="info-row">
      <span class="info-label">{{ t("resetsIn") }}</span>
      <span class="info-value">{{ resetTime }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  quotaPercent: number;
  dailyLimit: string;
  usedQuota: string;
  remainingQuota: number;
  resetTime: string;
}>();

const { t } = createUseI18n(messages)();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.quota-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  align-items: flex-end;
}

.quota-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gas-text-secondary);
  letter-spacing: 0.05em;
}

.quota-percent {
  font-size: 16px;
  font-weight: 800;
  color: var(--gas-quota-fill);
  font-family: $font-family;
}

.quota-bar-container {
  height: 8px;
  background: var(--gas-quota-bar-bg);
  border-radius: 4px;
  margin: 8px 0;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 2px var(--shadow-color);
}

.quota-fill {
  height: 100%;
  background: var(--gas-quota-fill);
  transition: width 0.5s ease-out;
  box-shadow: var(--gas-quota-fill-shadow);
  border-radius: 4px;
}

.quota-markers {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  margin-top: 4px;
  color: var(--gas-text-muted);
  font-weight: 500;
}

.quota-text {
  font-size: 11px;
  font-family: $font-mono;
  text-align: center;
  display: block;
  margin-top: 12px;
  margin-bottom: 16px;
  color: var(--gas-text);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--gas-divider);
  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--gas-text-muted);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  font-family: $font-family;
  color: var(--gas-text);

  &.highlight {
    color: var(--gas-highlight);
    text-shadow: var(--gas-highlight-shadow);
  }
}
</style>
