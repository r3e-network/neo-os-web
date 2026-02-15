<template>
  <NeoCard variant="erobo" class="mb-4">
    <ItemList :items="seeds" item-key="id">
      <template #item="{ item: seed }">
        <view
          class="seed-item-glass"
          role="button"
          tabindex="0"
          :aria-label="`${seed.name} — ${seed.price} GAS`"
          @click="$emit('plant', seed)"
        >
          <view class="seed-icon-wrapper-glass">
            <text class="seed-icon">{{ seed.icon }}</text>
          </view>
          <view class="seed-info">
            <text class="seed-name-glass">{{ seed.name }}</text>
            <text class="seed-time-glass">⏱ {{ seed.growTime }}{{ hoursLabel }}</text>
          </view>
          <view class="seed-price-tag-glass">
            <text class="seed-price-glass">{{ seed.price }}</text>
            <text class="seed-currency-glass">GAS</text>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import type { Seed } from "../composables/useGarden";

defineProps<{
  seeds: Seed[];
  hoursLabel: string;
}>();

defineEmits<{
  (e: "plant", seed: Seed): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.seeds-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.seed-item-glass {
  display: flex;
  align-items: center;
  gap: $spacing-6;
  padding: $spacing-4;
  background: var(--garden-seed-item-bg);
  border: 1px solid var(--garden-seed-item-border);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);

  &:active {
    background: var(--garden-seed-item-active-bg);
    transform: scale(0.98);
  }
}

.seed-icon-wrapper-glass {
  width: 56px;
  height: 56px;
  background: var(--garden-seed-icon-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--garden-seed-icon-border);
}

.seed-icon {
  font-size: 28px;
}
.seed-info {
  flex: 1;
}
.seed-name-glass {
  font-size: 16px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-primary);
  display: block;
}
.seed-time-glass {
  font-size: 12px;
  font-weight: $font-weight-medium;
  color: var(--text-secondary);
  margin-top: 4px;
  display: inline-block;
  background: var(--garden-seed-time-bg);
  padding: 2px 8px;
  border-radius: 12px;
}

.seed-price-tag-glass {
  background: var(--garden-price-bg);
  border: 1px solid var(--garden-price-border);
  color: var(--garden-price-text);
  padding: 8px 12px;
  border-radius: 12px;
  text-align: right;
  min-width: 80px;
}

.seed-price-glass {
  font-size: 18px;
  font-weight: $font-weight-black;
  line-height: 1;
  display: block;
}
.seed-currency-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  opacity: 0.8;
}
</style>
