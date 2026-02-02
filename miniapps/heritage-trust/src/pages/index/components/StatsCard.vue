<template>
  <NeoCard variant="erobo">
    <view class="stats-grid-neo">
      <view class="stat-item-neo">
        <text class="stat-label">{{ t("totalTrusts") }}</text>
        <text class="stat-value">{{ stats.totalTrusts }}</text>
      </view>
      <view class="stat-item-neo neo">
        <text class="stat-label">{{ t("totalNeoValue") }}</text>
        <text class="stat-value">{{ stats.totalNeoValue }} NEO</text>
      </view>
      <view class="stat-item-neo">
        <text class="stat-label">{{ t("activeTrusts") }}</text>
        <text class="stat-value">{{ stats.activeTrusts }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

export interface TrustStats {
  totalTrusts: number;
  totalNeoValue: number;
  activeTrusts: number;
}

defineProps<{
  stats: TrustStats;
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stats-grid-neo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-item-neo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  color: var(--text-primary);

  &.neo {
    background: linear-gradient(90deg, rgba(0, 229, 153, 0.05), transparent);
    border-left: 2px solid #00e599;
  }
}
.stat-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}
.stat-value {
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--text-primary);
}
</style>
