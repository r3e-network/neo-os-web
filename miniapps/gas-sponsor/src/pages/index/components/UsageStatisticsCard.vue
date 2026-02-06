<template>
  <NeoCard variant="accent">
    <view class="stat-grid">
      <NeoCard variant="default" class="flex-1 text-center">
        <AppIcon name="gas" :size="24" class="stat-icon" />
        <text class="stat-value">{{ formatBalance(usedQuota) }}</text>
        <text class="stat-label">{{ t("usedToday") }}</text>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <text class="stat-icon">🎯</text>
        <text class="stat-value">{{ formatBalance(remainingQuota) }}</text>
        <text class="stat-label">{{ t("available") }}</text>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <text class="stat-icon">📊</text>
        <text class="stat-value">{{ formatBalance(dailyLimit) }}</text>
        <text class="stat-label">{{ t("dailyLimit") }}</text>
      </NeoCard>
      <NeoCard variant="default" class="flex-1 text-center">
        <text class="stat-icon">⏰</text>
        <text class="stat-value">{{ resetTime }}</text>
        <text class="stat-label">{{ t("nextReset") }}</text>
      </NeoCard>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";

defineProps<{
  usedQuota: string;
  remainingQuota: number;
  dailyLimit: string;
  resetTime: string;
  t: (key: string) => string;
}>();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-2;
}
.stat-value {
  font-size: 14px;
  font-weight: $font-weight-black;
  font-family: $font-mono;
  display: block;
}
.stat-label {
  font-size: 8px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  opacity: 0.6;
}
</style>
