<template>
  <ActionModal :visible="show" :title="t('selectToken')" :closeable="true" @close="$emit('close')">
    <scroll-view scroll-y class="token-list" role="listbox" :aria-label="t('selectToken')">
      <view
        v-for="token in tokens"
        :key="token.symbol"
        class="token-option"
        role="option"
        :aria-selected="token.symbol === currentSymbol"
        :aria-label="token.symbol"
        tabindex="0"
        @click="$emit('select', token)"
        @keydown.enter="$emit('select', token)"
      >
        <AppIcon :name="token.symbol.toLowerCase()" :size="32" />
        <view class="token-info">
          <text class="token-name">{{ token.symbol }}</text>
          <text class="token-balance">{{ formatAmount(token.balance) }}</text>
        </view>
        <AppIcon v-if="token.symbol === currentSymbol" name="check" :size="20" class="check-mark" />
      </view>
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

defineEmits(["close", "select"]);

function formatAmount(amount: number): string {
  return amount.toFixed(4);
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.token-list {
  max-height: 400px;
}

.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
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
</style>
