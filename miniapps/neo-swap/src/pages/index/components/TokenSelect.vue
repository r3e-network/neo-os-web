<template>
  <view class="token-selector" role="button" :aria-label="`Select ${token.symbol}`" tabindex="0" @click="$emit('click')" @keydown.enter="$emit('click')">
    <image :src="getTokenIcon(token.symbol)" class="token-icon" mode="aspectFit" :alt="token.symbol" />
    <text class="token-symbol">{{ token.symbol }}</text>
    <view class="chevron" aria-hidden="true">›</view>
  </view>
</template>

<script setup lang="ts">
import type { Token } from "@/types";

const props = defineProps<{
  token: Token;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

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
  border: 1px solid var(--swap-chip-border);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--swap-chip-hover-bg);
    border-color: var(--swap-chip-hover-border);
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
