<template>
  <NeoCard variant="erobo" class="machine-card" @click="$emit('select', machine)">
    <view class="card-header">
      <view class="machine-icon-wrapper">
        <text class="machine-icon">🎰</text>
      </view>
      <view class="machine-info">
        <text class="machine-name">{{ machine.name }}</text>
        <text v-if="machine.category" class="machine-category">{{ machine.category }}</text>
        <text class="machine-creator">{{ t("byLabel") }} {{ formatAddress(machine.creator) }}</text>
      </view>
    </view>
    
    <view class="card-body">
      <view class="prize-preview">
        <text class="prize-label">{{ t("topPrizeLabel") }}</text>
        <text class="prize-value">{{ machine.topPrize || t("itemsCount", { count: machine.itemCount }) }}</text>
      </view>
      <view class="odds-preview">
        <text class="odds-label">{{ t("playsLabel") }}</text>
        <text class="odds-value highlight">{{ machine.plays ?? 0 }}</text>
      </view>
    </view>

    <view class="card-footer">
      <view class="price-tag">
        <text class="price-amount">{{ machine.price }}</text>
        <text class="price-unit">GAS</text>
      </view>
      <text v-if="machine.forSale" class="sale-hint">{{ t("forSale") }} · {{ machine.salePrice }} GAS</text>
      <text v-else class="play-hint">{{ t("tapToPlay") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  machine: {
    id: string;
    name: string;
    category?: string;
    creator: string;
    topPrize?: string;
    plays?: number;
    price: string;
    itemCount: number;
    forSale?: boolean;
    salePrice?: string;
  }
}>();

defineEmits(['select']);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.machine-card {
  height: 100%;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  margin-bottom: $spacing-3;
}

.machine-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--gacha-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gacha-panel-border);
}

.machine-icon {
  font-size: 20px;
}

.machine-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.machine-name {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 14px;
}

.machine-category {
  color: var(--gacha-accent-green);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.machine-creator {
  color: var(--text-secondary);
  font-size: 10px;
  font-family: $font-mono;
}

.card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
  margin-bottom: $spacing-3;
  padding: $spacing-2;
  background: var(--gacha-surface-strong);
  border-radius: 8px;
}

.prize-preview, .odds-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.prize-label, .odds-label {
  font-size: 9px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.prize-value, .odds-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
}

.highlight {
  color: var(--gacha-accent-green);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--gacha-divider);
  padding-top: $spacing-3;
}

.price-tag {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price-amount {
  font-size: 16px;
  font-weight: 800;
  color: var(--gacha-accent-yellow);
}

.price-unit {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
}

.play-hint {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sale-hint {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gacha-accent-amber);
}
</style>
