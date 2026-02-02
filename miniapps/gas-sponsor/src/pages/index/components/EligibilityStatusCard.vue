<template>
  <NeoCard variant="default">
    <view class="eligibility-check">
      <view class="check-item">
        <text class="check-icon">{{ parseFloat(gasBalance) < 0.1 ? "✓" : "✗" }}</text>
        <text class="check-text">{{ t("balanceCheck") }} ({{ formatBalance(gasBalance) }} GAS)</text>
      </view>
      <view class="check-item">
        <text class="check-icon">{{ remainingQuota > 0 ? "✓" : "✗" }}</text>
        <text class="check-text">{{ t("quotaCheck") }} ({{ formatBalance(remainingQuota) }} GAS)</text>
      </view>
      <view class="check-item">
        <text class="check-icon">{{ userAddress ? "✓" : "✗" }}</text>
        <text class="check-text">{{ t("walletCheck") }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  gasBalance: string;
  remainingQuota: number;
  userAddress: string;
  t: (key: string) => string;
}>();

const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.eligibility-check { display: flex; flex-direction: column; gap: $space-2; }
.check-item { display: flex; align-items: center; gap: $space-2; font-size: 10px; font-weight: $font-weight-bold; }
.check-icon { font-weight: $font-weight-black; color: var(--neo-green); }
</style>
