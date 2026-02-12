<template>
  <NeoCard variant="erobo-neo" class="liquidity-card">
    <view class="card-header" style="margin-bottom: 12px; height: 32px">
      <view class="live-indicator">
        <view class="live-dot"></view>
        <text class="live-text">{{ t("live") }}</text>
      </view>
      <text class="card-title">{{ t("poolBalance") }}</text>
      <view class="lightning-badge" style="width: 24px; height: 24px; font-size: 12px">⚡</view>
    </view>

    <view class="liquidity-item">
      <view class="item-header">
        <view class="token-badge gas">
          <text class="token-symbol">GAS</text>
        </view>
        <text class="token-amount">{{ formatNum(poolBalance) }}</text>
      </view>
      <text class="pool-note">{{ t("poolBalanceNote") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatNumber } from "@shared/utils/format";

defineProps<{
  poolBalance: number;
  t: (key: string) => string;
}>();

const formatNum = (n: number) => formatNumber(n, 4);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-6;
}

.card-title {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-primary);
  letter-spacing: 0.05em;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.2);
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 229, 153, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(0, 229, 153, 0.2);
}

.live-dot {
  width: 4px;
  height: 4px;
  background: var(--flash-success);
  border-radius: 50%;
  box-shadow: 0 0 5px var(--flash-success);
  animation: pulse 1.5s infinite;
}

.live-text {
  font-size: 8px;
  font-weight: 700;
  color: var(--flash-success);
  letter-spacing: 0.1em;
}

.lightning-badge {
  background: rgba(0, 229, 153, 0.2);
  color: var(--flash-success);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 0 15px rgba(0, 229, 153, 0.3);
  border: 1px solid rgba(0, 229, 153, 0.3);
}

.liquidity-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.token-badge {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.gas {
    background: rgba(0, 229, 153, 0.15);
    color: var(--flash-success);
    border: 1px solid rgba(0, 229, 153, 0.3);
  }
}

.token-amount {
  font-family: $font-mono;
  font-weight: 700;
  font-size: 20px;
  color: var(--text-primary);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.pool-note {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
