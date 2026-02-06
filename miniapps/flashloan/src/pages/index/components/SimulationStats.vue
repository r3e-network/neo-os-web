<template>
  <NeoCard variant="erobo" class="stats-overview">
    <view class="stats-grid">
      <NeoCard variant="erobo-neo" flat class="flex-1 text-center stat-card">
        <text class="stat-value">{{ stats.totalLoans }}</text>
        <text class="stat-label">{{ t("totalLoans") }}</text>
      </NeoCard>
      <NeoCard variant="erobo-neo" flat class="flex-1 text-center stat-card">
        <text class="stat-value">{{ formatNum(stats.totalVolume) }}</text>
        <text class="stat-label">{{ t("totalVolume") }}</text>
      </NeoCard>
      <NeoCard variant="erobo-neo" flat class="flex-1 text-center stat-card">
        <text class="stat-value">{{ stats.totalFees.toFixed(4) }}</text>
        <text class="stat-label">{{ t("totalFees") }}</text>
      </NeoCard>
      <NeoCard variant="erobo-neo" flat class="flex-1 text-center stat-card">
        <text class="stat-value">{{
          stats.totalLoans > 0 ? formatNum(stats.totalVolume / stats.totalLoans) : 0
        }}</text>
        <text class="stat-label">{{ t("avgLoanSize") }}</text>
      </NeoCard>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatNumber } from "@shared/utils/format";

defineProps<{
  stats: {
    totalLoans: number;
    totalVolume: number;
    totalFees: number;
  };
  t: (key: string) => string;
}>();

const formatNum = (n: number) => formatNumber(n, 2);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stats-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: $spacing-4;
  display: block;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-4;
}
.stat-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03) !important;
}
.stat-value {
  font-weight: 700;
  font-family: $font-mono;
  font-size: 18px;
  display: block;
  margin-bottom: 4px;
  color: var(--text-primary);
}
.stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.6;
  color: var(--text-primary);
}
</style>
