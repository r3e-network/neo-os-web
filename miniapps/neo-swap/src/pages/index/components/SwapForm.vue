<template>
  <view class="token-section">
    <view class="section-header">
      <text class="section-label">{{ label }}</text>
      <text class="balance-label">{{ t("balance") }}: {{ formatBalance(token.balance) }}</text>
    </view>
    <view class="token-row">
      <TokenSelect :token="token" @click="$emit('select')" />
      <input
        type="digit"
        :value="modelValue"
        :placeholder="placeholder"
        class="amount-input"
        :disabled="disabled"
        @input="onInput"
      />
    </view>
    <view v-if="showMax" class="max-btn" role="button" :aria-label="t('max')" tabindex="0" @click="$emit('max')" @keydown.enter="$emit('max')">{{ t("max") }}</view>
  </view>
</template>

<script setup lang="ts">
import type { Token } from "@/types";

const props = defineProps<{
  t: (key: string) => string;
  token: Token;
  modelValue: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  showMax?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "select"): void;
  (e: "max"): void;
}>();

function formatBalance(balance: number): string {
  return balance.toFixed(4);
}

function onInput(e: Record<string, unknown>) {
  emit("update:modelValue", e.detail?.value || e.target?.value || "");
}
</script>

<style lang="scss" scoped>
.token-section {
  position: relative;
  background: var(--swap-panel-bg);
  border: 1px solid var(--swap-panel-border);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 8px;
  transition: all 0.3s ease;

  &:focus-within {
    border-color: var(--swap-panel-focus-border);
    box-shadow: 0 0 20px var(--swap-panel-focus-glow);
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--swap-text-muted);
}

.balance-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--swap-text-subtle);
  font-family: "JetBrains Mono", monospace;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 32px;
  font-weight: 700;
  color: var(--swap-text);
  text-align: right;
  font-family: "Inter", sans-serif;

  &::placeholder {
    color: var(--swap-text-dim);
  }

  &:disabled {
    color: var(--swap-text-disabled);
  }
}

.max-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 10px;
  font-weight: 700;
  color: var(--swap-accent);
  background: var(--swap-accent-soft);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  letter-spacing: 0.1em;

  &:hover {
    background: var(--swap-accent-soft-strong);
  }
}
</style>
