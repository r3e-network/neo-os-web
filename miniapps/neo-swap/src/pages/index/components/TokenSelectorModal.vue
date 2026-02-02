<template>
  <view v-if="show" class="modal-overlay" @click="$emit('close')">
    <view class="modal-content scale-in" @click.stop>
      <view class="modal-header">
        <text class="modal-title">{{ t("selectToken") }}</text>
        <AppIcon name="x" :size="24" class="close-btn" @click="$emit('close')" />
      </view>
      <scroll-view scroll-y class="token-list">
        <view v-for="token in tokens" :key="token.symbol" class="token-option" @click="$emit('select', token)">
          <AppIcon :name="token.symbol.toLowerCase()" :size="32" />
          <view class="token-info">
            <text class="token-name">{{ token.symbol }}</text>
            <text class="token-balance">{{ formatAmount(token.balance) }}</text>
          </view>
          <AppIcon
            v-if="token.symbol === currentSymbol"
            name="check"
            :size="20"
            class="check-mark"
          />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { AppIcon } from "@shared/components";

type Token = {
  symbol: string;
  balance: number;
};

defineProps<{
  show: boolean;
  tokens: Token[];
  currentSymbol: string;
  t: (key: string) => string;
}>();

defineEmits(["close", "select"]);

function formatAmount(amount: number): string {
  return amount.toFixed(4);
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--swap-modal-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--swap-modal-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--swap-modal-border);
  width: 90%;
  max-width: 320px;
  box-shadow: 0 20px 50px var(--swap-shadow-press, rgba(0, 0, 0, 0.5));
  border-radius: 24px;
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--swap-modal-header-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 14px;
  color: var(--swap-modal-text);
  letter-spacing: 0.05em;
}

.close-btn {
  cursor: pointer;
  opacity: 0.6;
  &:hover { opacity: 1; }
}

.token-list {
  max-height: 400px;
  padding: 12px;
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

.scale-in {
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
