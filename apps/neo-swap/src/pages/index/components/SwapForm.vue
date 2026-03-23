<template>
  <div class="token-section">
    <div class="section-header">
      <span class="section-label">{{ label }}</span>
      <span class="balance-label">{{ t("balance") }}: {{ formatBalance(token.balance) }}</span>
    </div>
    <div class="token-row">
      <TokenSelect :token="token" @click="$emit('select')" />
      <input
        id="swap-amount-input"
        type="number"
        :value="modelValue"
        :placeholder="placeholder"
        class="amount-input"
        :disabled="disabled"
        :aria-label="label"
        :required="!disabled"
        @input="onInput"
      />
    </div>
    <button
      v-if="showMax"
      type="button"
      class="max-btn"
      :aria-label="t('max')"
      @click="$emit('max')"
    >{{ t("max") }}</button>
  </div>
</template>

<script setup lang="ts">
import type { Token } from "@/types";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  token: Token;
  modelValue: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  showMax?: boolean;
}>();

const { t } = createUseI18n(messages)();

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
  padding: 16px;
  margin-bottom: 8px;
  transition: all 0.3s ease;

  &:focus-within {
    border-color: var(--swap-panel-focus-border);
    box-shadow: 0 0 20px var(--swap-panel-focus-glow);
  }
}

@media (max-width: 480px) {
  .token-section {
    padding: 12px;
    border-radius: 14px;
  }

  .amount-input {
    font-size: 24px;
  }

  .max-btn {
    top: 12px;
    right: 12px;
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
  font-family: $font-mono;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 480px) {
  .token-row {
    gap: 8px;
  }
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 32px;
  font-weight: 700;
  color: var(--swap-text);
  text-align: right;
  font-family: $font-family;

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
  border: none;
  appearance: none;

  &:hover {
    background: var(--swap-accent-soft-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--swap-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(159, 157, 243, 0.15);
  }
}
</style>
