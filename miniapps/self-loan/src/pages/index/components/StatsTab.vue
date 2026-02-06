<template>
  <view class="tab-content scrollable">
    <NeoCard variant="erobo">
      <view class="flex flex-col gap-3">
        <NeoCard variant="default" flat class="flex justify-between items-center p-3 border-none!">
          <text class="stat-label">{{ t("totalLoans") }}</text>
          <text class="stat-value">{{ stats.totalLoans }}</text>
        </NeoCard>
        <NeoCard variant="default" flat class="flex justify-between items-center p-3 border-none!">
          <text class="stat-label">{{ t("totalBorrowed") }}</text>
          <text class="stat-value">{{ fmt(stats.totalBorrowed, 2) }} GAS</text>
        </NeoCard>
        <NeoCard variant="default" flat class="flex justify-between items-center p-3 border-none!">
          <text class="stat-label">{{ t("totalRepaid") }}</text>
          <text class="stat-value">{{ fmt(stats.totalRepaid, 2) }} GAS</text>
        </NeoCard>
        <NeoCard variant="default" flat class="flex justify-between items-center p-3 border-none!">
          <text class="stat-label">{{ t("avgLoanSize") }}</text>
          <text class="stat-value"
            >{{ stats.totalLoans > 0 ? fmt(stats.totalBorrowed / stats.totalLoans, 2) : 0 }} GAS</text
          >
        </NeoCard>
      </view>
    </NeoCard>
    <view class="stats-card">
      <text class="stats-title">{{ t("loanHistory") }}</text>
      <view v-for="(item, idx) in loanHistory" :key="idx" class="history-item">
        <text>{{ item.icon }} {{ item.label }}: {{ fmt(item.amount, 2) }} GAS - {{ item.timestamp }}</text>
      </view>
      <text v-if="loanHistory.length === 0" class="empty-text">{{ t("noHistory") }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";

const props = defineProps<{
  stats: any;
  loanHistory: any[];
  t: (key: string) => string;
}>();

const fmt = (n: number, d = 2) => formatNumber(n, d);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content {
  padding: $spacing-3;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.stats-card {
  background: var(--bg-card);
  border: $border-width-md solid var(--border-color);
  box-shadow: $shadow-md;
  padding: $spacing-4;
  margin-bottom: $spacing-3;
}

.stats-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--neo-green);
  text-transform: uppercase;
  display: block;
  margin-bottom: $spacing-3;
}

.history-item {
  padding: $spacing-2 0;
  border-bottom: $border-width-sm dashed var(--border-color);
  font-size: $font-size-sm;
  color: var(--text-primary);
  &:last-child { border-bottom: none; }
}

.stat-label {
  font-size: $font-size-xs;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.stat-value {
  font-size: $font-size-md;
  font-weight: $font-weight-bold;
  color: var(--text-primary);
}

.empty-text {
  font-style: italic;
  color: var(--text-muted);
  text-align: center;
  display: block;
  padding: $spacing-4;
}
</style>
