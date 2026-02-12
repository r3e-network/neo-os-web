<template>
  <view class="header">
    <view class="title-row">
      <text class="title">{{ t("app.title") }}</text>
      <text class="subtitle">{{ t("app.subtitle") }}</text>
    </view>
    <view class="status-row">
      <text class="status-chip">{{ chainLabel }}</text>
      <text class="status-chip" :class="{ connected: isConnected }">
        {{ isConnected ? formatAddress(userAddress) : t("wallet.not_connected") }}
      </text>
      <button class="connect-btn" v-if="!isConnected" @click="$emit('connect')">
        {{ t("wallet.connect") }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatAddress } from "@shared/utils/format";

defineProps<{
  chainLabel: string;
  userAddress: string;
  isConnected: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  connect: [];
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;

.header {
  padding: 20px;
  padding-bottom: 10px;
}

.title-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 14px;
  opacity: 0.7;
}

.status-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.status-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--piggy-chip-bg);
  border: 1px solid var(--piggy-chip-border);
  font-size: 11px;
  color: var(--piggy-chip-text);
}

.status-chip.connected {
  background: var(--piggy-chip-connected-bg);
  border-color: var(--piggy-chip-connected-border);
  color: var(--piggy-chip-connected-text);
}

.connect-btn {
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  color: var(--piggy-accent-text);
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-weight: 700;
  font-size: 11px;
}

@media (max-width: 767px) {
  .header {
    padding: 12px;
  }
  .title {
    font-size: 24px;
  }
}
</style>
