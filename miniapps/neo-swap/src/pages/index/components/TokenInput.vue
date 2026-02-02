<template>
  <view class="token-card">
    <view class="token-card-header">
      <text class="section-label">{{ label }}</text>
      <text class="balance-text">{{ t("balance") }}: {{ formatAmount(balance) }}</text>
    </view>
    <view class="token-input-row">
      <view class="token-select" @click="$emit('select-token')">
        <AppIcon :name="symbol.toLowerCase()" :size="32" />
        <view class="token-info">
          <text class="token-symbol">{{ symbol }}</text>
          <AppIcon name="chevron-right" :size="16" rotate="90" class="chevron-icon" />
        </view>
      </view>
      <NeoInput
        :modelValue="amount"
        @update:modelValue="$emit('update:amount', $event)"
        type="number"
        placeholder="0.0"
        :disabled="disabled"
        class="amount-input-wrapper"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { AppIcon, NeoInput } from "@shared/components";

defineProps<{
  label: string;
  symbol: string;
  balance: number;
  amount: string;
  disabled?: boolean;
  t: (key: string) => string;
}>();

defineEmits(["select-token", "update:amount"]);

function formatAmount(amount: number): string {
  return amount.toFixed(4);
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.token-card {
  margin-bottom: 24px;
}

.token-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}

.balance-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: $font-mono;
}

.token-input-row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--swap-panel-bg);
  border: 1px solid var(--swap-panel-border-strong);
  border-radius: 20px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  backdrop-filter: blur(10px);

  &:focus-within {
    border-color: var(--swap-panel-focus-border);
    background: var(--swap-chip-hover-bg);
    box-shadow: 0 0 20px var(--swap-panel-focus-glow);
  }
}

.token-select {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--swap-chip-bg);
  padding: 8px 14px 8px 10px;
  border-radius: 99px;
  border: 1px solid var(--swap-chip-border);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--swap-chip-hover-bg);
    transform: translateY(-1px);
  }
}

.token-symbol {
  font-weight: 800;
  font-size: 16px;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}

.token-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chevron-icon {
  opacity: 0.5;
}

.amount-input-wrapper {
  flex: 1;
  :deep(.uni-easyinput__content) {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
  }
  :deep(.uni-easyinput__content-input) {
    font-size: 28px !important;
    font-family: $font-family !important;
    font-weight: 700 !important;
    color: var(--text-primary) !important;
    text-align: right !important;
    height: 48px;
    padding: 0 !important;
    text-shadow: 0 0 20px var(--swap-input-text-glow) !important;
  }
}
</style>
