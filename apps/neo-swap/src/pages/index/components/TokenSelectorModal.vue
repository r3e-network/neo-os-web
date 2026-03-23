<template>
  <ActionModal :visible="show" :title="t('selectToken')" :closeable="true" @close="$emit('close')">
    <scroll-view scroll-y class="token-list" role="listbox" :aria-label="t('selectToken')">
      <li
        v-for="token in tokens"
        :key="token.symbol"
        class="token-option"
        role="option"
        :aria-selected="token.symbol === currentSymbol"
        :aria-label="token.symbol"
        tabindex="0"
        @click="$emit('select', token)"
        @keydown.enter="$emit('select', token)"
        @keydown.space.prevent="$emit('select', token)"
      >
        <AppIcon :name="token.symbol.toLowerCase()" :size="32" aria-hidden="true" />
        <div class="token-info">
          <span class="token-name">{{ token.symbol }}</span>
          <span class="token-balance">{{ formatAmount(token.balance) }}</span>
        </div>
        <AppIcon v-if="token.symbol === currentSymbol" name="check" :size="20" class="check-mark" aria-hidden="true" />
      </li>
    </scroll-view>
  </ActionModal>
</template>

<script setup lang="ts">
import { ActionModal, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

type Token = {
  symbol: string;
  balance: number;
};

defineProps<{
  show: boolean;
  tokens: Token[];
  currentSymbol: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "close"): void;
  (e: "select", token: Token): void;
}>();

function formatAmount(amount: number): string {
  return amount.toFixed(4);
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.token-list {
  max-height: 400px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  list-style: none;

  &:hover {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
  }

  &:focus-visible {
    outline: 2px solid var(--swap-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(159, 157, 243, 0.15);
  }
}

.token-info {
  flex: 1;
}

.token-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--swap-modal-text);
  display: block;
}

.token-balance {
  font-size: 12px;
  opacity: 0.6;
  color: var(--swap-modal-text-muted);
  font-family: $font-mono;
  display: block;
}

.check-mark {
  color: var(--swap-accent);
}

@media (max-width: 480px) {
  .token-list {
    max-height: 300px;
  }

  .token-option {
    padding: 10px;
  }

  .token-name {
    font-size: 14px;
  }

  .token-balance {
    font-size: 11px;
  }
}
</style>
