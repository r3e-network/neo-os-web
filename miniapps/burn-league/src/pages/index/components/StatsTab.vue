<template>
  <NeoCard variant="erobo">
    <view class="stat-row">
      <text class="stat-label">{{ t("totalGames") }}</text>
      <text class="stat-value">{{ burnCount }}</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("youBurned") }}</text>
      <text class="stat-value">{{ formatNum(userBurned) }} GAS</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("totalBurned") }}</text>
      <text class="stat-value">{{ formatNum(totalBurned) }} GAS</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("rank") }}</text>
      <text class="stat-value">#{{ rank }}</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("estimatedRewards") }}</text>
      <text class="stat-value">{{ formatNum(estimatedReward) }} {{ t("points") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  burnCount: number;
  userBurned: number;
  totalBurned: number;
  rank: number;
  estimatedReward: number;
  t: (key: string) => string;
}>();

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  &:last-child {
    border-bottom: none;
  }
}

.stat-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.1em;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  font-family: $font-mono;
  color: #9f9df3;
  text-shadow: 0 0 10px rgba(159, 157, 243, 0.3);
}
</style>
