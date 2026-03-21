<template>
  <div
    v-if="show"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="t('selectToken')"
    @click="$emit('close')"
  >
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <span class="modal-title">{{ t("selectToken") }}</span>
        <button
          type="button"
          class="modal-close"
          :aria-label="t('close')"
          @click="$emit('close')"
        >×</button>
      </div>
      <div class="token-list" role="listbox" :aria-label="t('selectToken')">
        <li
          v-for="token in tokens"
          :key="token.symbol"
          :class="['token-item', { selected: isSelected(token) }]"
          role="option"
          :aria-selected="isSelected(token)"
          :aria-label="token.symbol"
          tabindex="0"
          @click="$emit('select', token)"
          @keydown.enter="$emit('select', token)"
          @keydown.space.prevent="$emit('select', token)"
        >
          <img
            :src="getTokenIcon(token.symbol)"
            class="token-list-icon"
            mode="aspectFit"
            :alt="token.symbol?.trim() || t('tokenIcon')"
          />
          <div class="token-item-info">
            <span class="token-item-symbol">{{ token.symbol }}</span>
            <span class="token-item-balance">{{ formatBalance(token.balance) }}</span>
          </div>
        </li>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Token } from "@/types";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  show: boolean;
  tokens: Token[];
  currentSymbol: string;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", token: Token): void;
}>();

function isSelected(token: Token): boolean {
  return token.symbol === props.currentSymbol;
}

function getTokenIcon(symbol: string): string {
  if (symbol === "NEO") return "/neo-token.png";
  if (symbol === "GAS") return "/gas-token.png";
  return "/logo.jpg";
}

function formatBalance(balance: number): string {
  return balance.toFixed(4);
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--swap-modal-overlay);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 360px;
  background: var(--swap-modal-bg);
  border: 1px solid var(--swap-modal-border);
  border-radius: 24px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--swap-modal-header-border);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--swap-modal-text);
}

.modal-close {
  font-size: 28px;
  color: var(--swap-modal-text-muted);
  cursor: pointer;
  line-height: 1;
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;

  &:hover {
    color: var(--swap-modal-text);
  }
}

.token-list {
  padding: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  list-style: none;

  &:hover {
    background: var(--swap-chip-hover-bg);
  }

  &.selected {
    background: var(--swap-accent-soft);
    border: 1px solid var(--swap-chip-hover-border);
  }
}

.token-list-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    max-width: 100%;
    border-radius: 16px;
  }

  .token-list-icon {
    width: 36px;
    height: 36px;
  }

  .token-item-symbol {
    font-size: 16px;
  }

  .token-item-balance {
    font-size: 11px;
  }
}

.token-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.token-item-symbol {
  font-size: 18px;
  font-weight: 700;
  color: var(--swap-modal-text);
}

.token-item-balance {
  font-size: 13px;
  color: var(--swap-modal-text-muted);
  font-family: "JetBrains Mono", monospace;
}
</style>
