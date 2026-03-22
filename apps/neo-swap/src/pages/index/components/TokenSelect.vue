<template>
  <button type="button" class="token-selector" :aria-label="t('selectTokenAria', { token: token.symbol || '' })" @click="$emit('click')">
    <img :src="getTokenIcon(token.symbol)" class="token-icon" mode="aspectFit" :alt="token.symbol" />
    <span class="token-symbol">{{ token.symbol }}</span>
    <div class="chevron" aria-hidden="true">›</div>
  </button>
</template>

<script setup lang="ts">
import type { Token } from "@/types";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  token: Token;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

const { t } = createUseI18n(messages)();

function getTokenIcon(symbol: string): string {
  if (symbol === "NEO") return "/neo-token.png";
  if (symbol === "GAS") return "/gas-token.png";
  return "/logo.jpg";
}
</script>

<style lang="scss" scoped>
.token-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--swap-chip-bg);
  padding: 10px 16px;
  border-radius: 16px;
  border: none;
  appearance: none;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--swap-chip-hover-bg);
    border-color: var(--swap-chip-hover-border);
  }

  &:focus-visible {
    outline: 2px solid var(--swap-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(159, 157, 243, 0.15);
  }
}

.token-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.token-symbol {
  font-size: 18px;
  font-weight: 800;
  color: var(--swap-text);
  letter-spacing: 0.05em;
}

.chevron {
  font-size: 20px;
  color: var(--swap-text-subtle);
  margin-left: 4px;
}
</style>
