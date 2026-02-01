<template>
  <view v-if="show" class="modal-overlay" @click="$emit('close')">
    <view class="modal-content" @click.stop>
      <view class="modal-header">
        <text class="modal-title">{{ t("selectToken") }}</text>
        <view class="modal-close" @click="$emit('close')">×</view>
      </view>
      <view class="token-list">
        <view
          v-for="token in tokens"
          :key="token.symbol"
          :class="['token-item', { selected: isSelected(token) }]"
          @click="$emit('select', token)"
        >
          <image :src="getTokenIcon(token.symbol)" class="token-list-icon" mode="aspectFit" :alt="token.symbol || t('tokenIcon')" />
          <view class="token-item-info">
            <text class="token-item-symbol">{{ token.symbol }}</text>
            <text class="token-item-balance">{{ formatBalance(token.balance) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Token {
  symbol: string;
  hash: string;
  balance: number;
  decimals: number;
}

const props = defineProps<{
  t: (key: string) => string;
  show: boolean;
  tokens: Token[];
  currentSymbol: string;
}>();

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

  &:hover {
    color: var(--swap-modal-text);
  }
}

.token-list {
  padding: 12px;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

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
  font-family: 'JetBrains Mono', monospace;
}
</style>
