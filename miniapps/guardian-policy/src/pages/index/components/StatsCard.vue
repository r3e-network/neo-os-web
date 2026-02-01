<template>
  <NeoCard class="stats-card" variant="erobo-neo">
    <view class="stat-row">
      <text class="stat-label">{{ t("totalPolicies") }}</text>
      <text class="stat-value">{{ stats.totalPolicies }}</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("activePoliciesCount") }}</text>
      <text class="stat-value">{{ stats.activePolicies }}</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("claimedPolicies") }}</text>
      <text class="stat-value">{{ stats.claimedPolicies }}</text>
    </view>
    <view class="stat-row">
      <text class="stat-label">{{ t("totalCoverage") }}</text>
      <text class="stat-value">{{ stats.totalCoverage }} GAS</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  stats: {
    totalPolicies: number;
    activePolicies: number;
    claimedPolicies: number;
    totalCoverage: number;
  };
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.stats-card { margin-bottom: $space-4; }

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: $space-3 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.stat-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}
.stat-value {
  font-family: $font-mono;
  font-weight: 700;
  font-size: 14px;
  background: transparent;
  color: var(--text-primary);
  padding: 0 8px;
  text-shadow: 0 0 10px rgba(159, 157, 243, 0.4);
}
</style>
