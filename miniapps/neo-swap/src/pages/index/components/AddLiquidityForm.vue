<template>
  <NeoCard variant="erobo" class="mb-4">
    <view class="token-input-section">
      <view class="section-header">
        <text class="input-label">NEO</text>
        <text class="balance-label">{{ t("balance") }}: 0.00</text>
      </view>
      <NeoInput
        :modelValue="amountA"
        @update:modelValue="$emit('update:amountA', $event)"
        type="number"
        placeholder="0.0"
        @input="$emit('calculateB')"
        class="seamless-input"
      />
    </view>

    <view class="plus-divider">
      <view class="plus-icon-circle">
        <AppIcon name="plus" :size="16" />
      </view>
    </view>

    <view class="token-input-section">
      <view class="section-header">
        <text class="input-label">GAS</text>
        <text class="balance-label">{{ t("balance") }}: 0.00</text>
      </view>
      <NeoInput
        :modelValue="amountB"
        @update:modelValue="$emit('update:amountB', $event)"
        type="number"
        placeholder="0.0"
        @input="$emit('calculateA')"
        class="seamless-input"
      />
    </view>

    <view class="rate-info">
        1 NEO ≈ 8.5 GAS
    </view>

    <NeoButton variant="primary" block @click="$emit('addLiquidity')" :loading="loading">
      {{ t("addLiquidity") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components";

defineProps<{
  amountA: string;
  amountB: string;
  loading: boolean;
  t: (key: string) => string;
}>();

defineEmits(["update:amountA", "update:amountB", "calculateA", "calculateB", "addLiquidity"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.token-input-section {
  background: var(--swap-panel-bg);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--swap-panel-border-strong);
  transition: all 0.2s;

  &:focus-within {
    border-color: var(--swap-panel-focus-border);
    box-shadow: 0 0 15px var(--swap-panel-focus-glow);
    background: var(--swap-chip-hover-bg);
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.input-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--swap-text-muted);
  letter-spacing: 0.1em;
}

.balance-label {
  font-size: 11px;
  font-weight: 500;
  font-family: $font-mono;
  color: var(--swap-text-muted);
}

.plus-divider {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 32px;
  position: relative;
  z-index: 1;
}

.plus-icon-circle {
  width: 24px;
  height: 24px;
  background: var(--swap-chip-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--swap-text-muted);
}

.rate-info {
  font-size: 12px;
  font-weight: 600;
  color: var(--swap-text-muted);
  margin: 16px 0 24px;
  text-align: center;
}

.seamless-input {
  :deep(.uni-easyinput__content) {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
  }
  :deep(.uni-easyinput__content-input) {
    font-size: 20px !important;
    font-weight: 600 !important;
    color: var(--text-primary) !important;
    height: 32px;
    padding: 0 !important;
    text-align: right !important; 
  }
}

.mb-4 { margin-bottom: 16px; }
</style>
