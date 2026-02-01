<template>
  <NeoCard class="summary-card" variant="erobo">
    <view class="summary-container">
      <view class="usd-value-row">
        <text class="usd-sign">$</text>
        <text class="usd-amount">{{ formatNum(totalUsd) }}</text>
      </view>
      
      <view class="token-split">
        <view class="token-item">
          <text class="token-label">NEO</text>
          <text class="token-value">{{ formatNum(totalNeo) }}</text>
        </view>
        <view class="divider"></view>
        <view class="token-item">
          <text class="token-label">GAS</text>
          <text class="token-value">{{ formatNum(totalGas, 2) }}</text>
        </view>
      </view>
      
      <view class="last-updated">
        <text>{{ t('lastUpdated') }}: {{ formatTime(lastUpdated) }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: number;
  t: (key: string) => string;
}>();

const formatNum = (n: number, decimals = 0): string => {
  return n.toLocaleString("en-US", { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
};

const formatTime = (ts: number): string => {
  return new Date(ts).toLocaleTimeString();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.summary-card {
  margin-bottom: 24px;
}

.summary-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.usd-value-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  justify-content: center;
  width: 100%;
}

.usd-sign {
  font-size: 24px;
  font-weight: 700;
  color: #00E599;
  margin-top: 8px;
  text-shadow: 0 0 15px rgba(0, 229, 153, 0.4);
}

.usd-amount {
  font-size: 48px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--text-primary);
  line-height: 1;
  text-shadow: 0 0 40px rgba(0, 229, 153, 0.4);
}

.token-split {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 16px;
  backdrop-filter: blur(10px);
  padding: 20px;
  margin-top: 8px;
}

.token-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
}

.token-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  margin-bottom: 6px;
  letter-spacing: 0.1em;
}

.token-value {
  font-size: 20px;
  font-weight: 700;
  font-family: $font-family;
  color: var(--text-primary);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

.divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
}

.last-updated {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted, rgba(255, 255, 255, 0.3));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}
</style>
