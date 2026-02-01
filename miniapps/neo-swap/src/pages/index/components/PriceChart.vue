<template>
  <view class="rate-card" v-if="exchangeRate && !loading">
    <view class="rate-row">
      <text class="rate-label">{{ t("exchangeRate") }}</text>
      <text class="rate-value">1 {{ fromSymbol }} = {{ exchangeRate }} {{ toSymbol }}</text>
    </view>
    <view class="rate-row">
      <text class="rate-label">{{ t("slippage") }}</text>
      <text class="rate-value slippage">{{ slippage }}</text>
    </view>
    <view class="rate-row">
      <text class="rate-label">{{ t("minReceived") }}</text>
      <text class="rate-value">{{ minReceived }} {{ toSymbol }}</text>
    </view>
    <view class="refresh-btn" @click="$emit('refresh')">
      <text class="refresh-icon">↻</text>
      {{ t("refreshRate") }}
    </view>
  </view>
  <view class="rate-card loading" v-else>
    <text class="rate-loading-text">{{ loading ? t('loadingRate') : t('rateUnavailable') }}</text>
    <view class="refresh-btn" @click="$emit('refresh')">
      <text class="refresh-icon">↻</text>
      {{ t("refreshRate") }}
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  t: (key: string) => string;
  exchangeRate: string;
  fromSymbol: string;
  toSymbol: string;
  slippage: string;
  minReceived: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
}>();
</script>

<style lang="scss" scoped>
.rate-card {
  background: var(--swap-card-soft);
  border: 1px solid var(--swap-panel-border);
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;

  &.loading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.rate-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--swap-rate-border);

  &:last-of-type {
    border-bottom: none;
  }
}

.rate-label {
  font-size: 12px;
  color: var(--swap-text-muted);
}

.rate-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--swap-text);
  font-family: 'JetBrains Mono', monospace;

  &.slippage {
    color: var(--swap-accent);
  }
}

.rate-loading-text {
  font-size: 12px;
  color: var(--swap-text-subtle);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--swap-text-muted);
  padding: 8px 12px;
  border: 1px solid var(--swap-panel-border-strong);
  border-radius: 8px;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;

  &:hover {
    color: var(--swap-accent);
    border-color: var(--swap-chip-hover-border);
  }
}

.refresh-icon {
  font-size: 14px;
}
</style>
