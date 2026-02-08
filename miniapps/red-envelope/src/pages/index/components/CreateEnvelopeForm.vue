<template>
  <NeoCard variant="erobo-neo">
    <view class="type-selector">
      <button
        class="type-btn"
        :class="{ active: envelopeType === 'spreading' }"
        @click="$emit('update:envelopeType', 'spreading')"
      >
        {{ t("typeSpreading") }}
      </button>
      <button
        class="type-btn"
        :class="{ active: envelopeType === 'lucky' }"
        @click="$emit('update:envelopeType', 'lucky')"
      >
        {{ t("typeLucky") }}
      </button>
    </view>

    <view class="flow-banner">
      <text class="flow-desc">
        {{ envelopeType === "lucky" ? t("typeLuckyDesc") : t("typeSpreadingDesc") }}
      </text>
      <text class="flow-steps">
        {{ envelopeType === "lucky" ? t("flowBannerLucky") : t("flowBannerSpreading") }}
      </text>
    </view>

    <view class="input-group">
      <NeoInput
        :modelValue="name"
        @update:modelValue="$emit('update:name', $event)"
        :placeholder="t('namePlaceholder')"
      />
      <NeoInput
        :modelValue="description"
        @update:modelValue="$emit('update:description', $event)"
        :placeholder="t('defaultBlessing')"
      />
      <NeoInput
        :modelValue="amount"
        @update:modelValue="$emit('update:amount', $event)"
        type="number"
        :placeholder="t('totalGasPlaceholder')"
        suffix="GAS"
      />
      <NeoInput
        :modelValue="count"
        @update:modelValue="$emit('update:count', $event)"
        type="number"
        :placeholder="t('packetsPlaceholder')"
      />
      <NeoInput
        :modelValue="expiryHours"
        @update:modelValue="$emit('update:expiryHours', $event)"
        type="number"
        :placeholder="t('expiryPlaceholder')"
        suffix="h"
      />
      <view class="neo-gate-section">
        <text class="section-label">{{ t("neoRequirement") }}</text>
        <NeoInput
          :modelValue="minNeoRequired"
          @update:modelValue="$emit('update:minNeoRequired', $event)"
          type="number"
          :placeholder="t('minNeoPlaceholder')"
          suffix="NEO"
        />
        <NeoInput
          :modelValue="minHoldDays"
          @update:modelValue="$emit('update:minHoldDays', $event)"
          type="number"
          :placeholder="t('minHoldDaysPlaceholder')"
          suffix="days"
        />
      </view>
    </view>
    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('create')" class="send-button">
      <view class="btn-content">
        <AppIcon name="envelope" :size="24" />
        <text class="button-text">{{ t("sendRedEnvelope") }}</text>
      </view>
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components";

import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";

defineProps<{
  name: string;
  description: string;
  amount: string;
  count: string;
  expiryHours: string;
  minNeoRequired: string;
  minHoldDays: string;
  envelopeType: EnvelopeType;
  isLoading: boolean;
  t: (key: string) => string;
}>();

defineEmits([
  "update:envelopeType",
  "update:name",
  "update:description",
  "update:amount",
  "update:count",
  "update:expiryHours",
  "update:minNeoRequired",
  "update:minHoldDays",
  "create",
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

$gold: #f1c40f;
$gold-dark: #d4ac0d;
$premium-red-dark: #922b21;

.type-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.type-btn {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba($gold, 0.3);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: linear-gradient(135deg, $gold 0%, $gold-dark 100%);
    color: $premium-red-dark;
    border-color: $gold;
    box-shadow: 0 2px 8px rgba($gold-dark, 0.3);
  }
}

.flow-banner {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  border: 1px solid rgba($gold, 0.15);
  text-align: center;
}

.flow-desc {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.flow-steps {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: $gold;
  letter-spacing: 0.02em;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 32px;
}

.neo-gate-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba($gold, 0.2);
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: $gold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:deep(.neo-input) {
  background: rgba(255, 255, 255, 0.9) !important;
  border-color: transparent !important;
  color: $premium-red-dark !important;

  &:focus-within {
    border-color: $gold !important;
    box-shadow: 0 0 0 2px rgba($gold, 0.3) !important;
  }
}

.send-button {
  background: linear-gradient(135deg, $gold 0%, $gold-dark 100%) !important;
  border: none !important;
  box-shadow: 0 4px 15px rgba($gold-dark, 0.4) !important;

  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 10px rgba($gold-dark, 0.3) !important;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: $premium-red-dark; /* Contrast text on gold button */
}

.button-text {
  font-weight: 800;
  text-transform: uppercase;
  font-family: $font-family;
  letter-spacing: 0.05em;
  font-size: 16px;
  color: $premium-red-dark;
}
</style>
