<template>
  <view class="stats-grid">
    <NeoCard variant="erobo" class="flex-1 text-center">
      <text class="stat-icon">🔥</text>
      <text class="stat-value">{{ formatNum(userBurned) }}</text>
      <text class="stat-label">{{ t("youBurned") }}</text>
    </NeoCard>
    <NeoCard variant="erobo-neo" class="flex-1 text-center">
      <text class="stat-icon">{{ getRankIcon(rank) }}</text>
      <text class="stat-value">#{{ rank }}</text>
      <text class="stat-label">{{ t("rank") }}</text>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  userBurned: number;
  rank: number;
  t: (key: string) => string;
}>();

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const getRankIcon = (rank: number): string => {
  if (rank <= 3) return "👑";
  if (rank <= 10) return "⭐";
  return "📊";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.2));
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.1em;
}
</style>
