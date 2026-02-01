<template>
  <NeoCard variant="erobo-neo">
    <view class="stats-grid">
      <view class="stat-box-glass">
        <text class="stat-value-glass">{{ formatNum(totalPot) }}</text>
        <text class="stat-label-glass">{{ t("totalPot") }}</text>
      </view>
      <view class="stat-box-glass">
        <text class="stat-value-glass">{{ userKeys }}</text>
        <text class="stat-label-glass">{{ t("yourKeys") }}</text>
      </view>
      <view class="stat-box-glass">
        <text class="stat-value-glass">#{{ roundId }}</text>
        <text class="stat-label-glass">{{ t("round") }}</text>
      </view>
    </view>
    <view class="stats-subgrid">
      <view class="stat-row-glass">
        <text class="stat-row-label-glass">{{ t("lastBuyer") }}</text>
        <text class="stat-row-value-glass">{{ lastBuyerLabel }}</text>
      </view>
      <view class="stat-row-glass">
        <text class="stat-row-label-glass">{{ t("roundStatus") }}</text>
        <text class="stat-row-value-glass" :class="{ active: isRoundActive }">
          {{ isRoundActive ? t("activeRound") : t("inactiveRound") }}
        </text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  totalPot: number;
  userKeys: number;
  roundId: number;
  lastBuyerLabel: string;
  isRoundActive: boolean;
  t: (key: string) => string;
}>();

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0.00";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $space-4;
}

.stat-box-glass {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: $space-3;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-value-glass {
  font-size: 18px;
  font-weight: $font-weight-bold;
  font-family: $font-mono;
  display: block;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.stat-label-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.stats-subgrid {
  margin-top: $space-6;
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
.stat-row-glass {
  display: flex;
  justify-content: space-between;
  padding: $space-3;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.stat-row-label-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.stat-row-value-glass {
  font-size: 12px;
  font-weight: $font-weight-medium;
  font-family: $font-mono;
  color: var(--text-primary);
  &.active {
    color: #34d399;
    text-shadow: 0 0 5px rgba(52, 211, 153, 0.5);
  }
}
</style>
