<template>
  <NeoCard variant="erobo-neo" class="tile-info">
    <view class="info-row">
      <text class="info-label">{{ t("position") }}:</text>
      <text class="info-value">{{ t("tile") }} #{{ selectedTile }} ({{ selectedX }}, {{ selectedY }})</text>
    </view>
    <view class="info-row">
      <text class="info-label">{{ t("status") }}:</text>
      <text :class="['info-value', isOwned ? 'status-owned' : 'status-free']">
        {{ isOwned ? t("occupied") : t("available") }}
      </text>
    </view>
    <view class="info-row price-row">
      <text class="info-label">{{ t("price") }}:</text>
      <text class="info-value price-value">{{ tilePrice }} GAS</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  selectedTile: number;
  selectedX: number;
  selectedY: number;
  isOwned: boolean;
  tilePrice: number;
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.tile-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.info-value {
  font-size: 14px;
  font-weight: 700;
  font-family: $font-mono;

  &.status-owned {
    color: var(--map-red);
  }
  &.status-free {
    color: var(--neo-green);
  }
  &.price-value {
    color: var(--map-gold);
    font-size: 16px;
  }
}

.price-row {
  padding-top: 8px;
  border-top: 1px solid var(--map-border);
}
</style>
