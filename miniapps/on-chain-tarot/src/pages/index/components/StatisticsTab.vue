<template>
  <NeoCard variant="erobo" class="mystical-card">
    <view class="stat-row-glass">
      <text class="stat-label-glass">{{ t("totalGames") }}</text>
      <text class="stat-value-glass">{{ readingsCount }}</text>
    </view>
    <view class="stat-row-glass">
      <text class="stat-label-glass">{{ t("cardsDrawnCount") }}</text>
      <text class="stat-value-glass">{{ readingsCount * 3 }}</text>
    </view>
    <view class="stat-row-glass">
      <text class="stat-label-glass">{{ t("totalSpent") }}</text>
      <text class="stat-value-glass">{{ (readingsCount * 0.05).toFixed(2) }} GAS</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  readingsCount: number;
  t: (key: string, ...args: unknown[]) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stat-row-glass {
  display: flex;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  align-items: center;
  &:last-child {
    border-bottom: none;
  }
}

.stat-label-glass {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}

.stat-value-glass {
  font-weight: 700;
  font-family: $font-mono;
  font-size: 16px;
  color: var(--tarot-stat-value);
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
}
</style>
