<template>
  <NeoCard variant="erobo-neo" class="tile-info">
    <div class="info-row">
      <span class="info-label">{{ t("position") }}:</span>
      <span class="info-value">{{ t("tile") }} #{{ selectedTile }} ({{ selectedX }}, {{ selectedY }})</span>
    </div>
    <div class="info-row">
      <span class="info-label">{{ t("status") }}:</span>
      <span :class="['info-value', isOwned ? 'status-owned' : 'status-free']">
        {{ isOwned ? t("occupied") : t("available") }}
      </span>
    </div>
    <div class="info-row price-row">
      <span class="info-label">{{ t("price") }}:</span>
      <span class="info-value price-value">{{ tilePrice }} GAS</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  selectedTile: number;
  selectedX: number;
  selectedY: number;
  isOwned: boolean;
  tilePrice: number;
}>();

const { t } = createUseI18n(messages)();
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
