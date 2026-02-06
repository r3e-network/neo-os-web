<template>
  <NeoCard variant="erobo-neo" class="borrow-card">
    <view class="input-section">
      <NeoInput
        :modelValue="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
        type="number"
        :label="t('collateralAmount')"
        :placeholder="t('amountToLock')"
        suffix="NEO"
      />
    </view>

    <view v-if="ltvOptions.length" class="tier-section">
      <text class="tier-label">{{ t("ltvTier") }}</text>
      <view class="tier-grid">
        <view
          v-for="option in ltvOptions"
          :key="option.tier"
          :class="['tier-card', { active: option.tier === selectedTier }]"
          @click="emit('update:selectedTier', option.tier)"
        >
          <text class="tier-title">{{ option.label }}</text>
          <text class="tier-percent">{{ option.percent }}%</text>
          <text v-if="option.desc" class="tier-desc">{{ option.desc }}</text>
        </view>
      </view>
    </view>

    <view class="ltv-section-glass">
      <view class="ltv-header">
        <text class="ltv-label">{{ t("loanToValue") }}</text>
        <text :class="['ltv-value', getLTVClass()]">{{ calculatedLTV }}%</text>
      </view>
      <view class="ltv-track">
        <view class="ltv-fill-glass" :style="{ width: calculatedLTV + '%', background: getLTVColor() }">
          <view class="ltv-glimmer"></view>
        </view>
        <view class="ltv-marker" style="left: 50%"></view>
        <view class="ltv-marker" style="left: 66.7%"></view>
      </view>
      <view class="ltv-labels">
        <text class="ltv-min">0%</text>
        <text class="ltv-mid">50%</text>
        <text class="ltv-max">100%</text>
      </view>
    </view>

    <view class="calculator-receipt">
      <view class="calc-row">
        <text class="calc-label">{{ estimatedLabel }}</text>
        <text class="calc-value mono collateral-req">{{ fmt(estimatedBorrowNet, 2) }} GAS</text>
      </view>
      <view v-if="platformFeeBps > 0" class="calc-row">
        <text class="calc-label">{{ feeLabel }}</text>
        <text class="calc-value mono fee">{{ fmt(feeAmount, 2) }} GAS</text>
      </view>
      <view class="calc-row">
        <text class="calc-label">{{ t("collateralRatio") }}</text>
        <text class="calc-value mono payment">{{ fmt(collateralRatio, 2) }}x</text>
      </view>
      <view class="calc-divider"></view>
      <view class="calc-row total">
        <text class="calc-label">{{ t("minDuration") }}</text>
        <text class="calc-value mono total">{{ terms.minDurationHours }}h</text>
      </view>
    </view>

    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('takeLoan')" class="borrow-btn">
      <text>{{ isLoading ? t("processing") : t("borrowNow") }}</text>
    </NeoButton>
    <text class="note-glass">{{ t("note") }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber } from "@shared/utils/format";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";

const props = defineProps<{
  modelValue: string;
  terms: any;
  isLoading: boolean;
  ltvOptions: { tier: number; percent: number; label: string; desc?: string }[];
  selectedTier: number;
  platformFeeBps?: number;
  t: (key: string) => string;
}>();

const emit = defineEmits(["update:modelValue", "update:selectedTier", "takeLoan"]);

const fmt = (n: number, d = 2) => formatNumber(n, d);

const selectedOption = computed(
  () => props.ltvOptions.find((option) => option.tier === props.selectedTier),
);
const ltvPercent = computed(() => Number(selectedOption.value?.percent ?? props.terms?.ltvPercent ?? 20));
const collateralAmount = computed(() => parseFloat(props.modelValue || "0") || 0);
const estimatedBorrow = computed(() => (collateralAmount.value * ltvPercent.value) / 100);
const platformFeeBps = computed(() => Number(props.platformFeeBps ?? props.terms?.platformFeeBps ?? 0));
const feeAmount = computed(() => (estimatedBorrow.value * platformFeeBps.value) / 10000);
const estimatedBorrowNet = computed(() => Math.max(estimatedBorrow.value - feeAmount.value, 0));
const collateralRatio = computed(() => (ltvPercent.value > 0 ? 100 / ltvPercent.value : 0));
const feePercent = computed(() => (platformFeeBps.value / 100).toFixed(2).replace(/\.00$/, ""));
const feeLabel = computed(() => props.t("originationFee").replace("{percent}", feePercent.value));
const estimatedLabel = computed(() => props.t("estimatedBorrowNet"));

const calculatedLTV = computed(() => {
  if (!collateralAmount.value) return 0;
  return Math.min(Math.round(ltvPercent.value), 100);
});

const getLTVClass = () => {
  const ltv = calculatedLTV.value;
  if (ltv <= 50) return "safe";
  if (ltv <= 66.7) return "warning";
  return "danger";
};

const getLTVColor = () => {
  const ltv = calculatedLTV.value;
  if (ltv <= 50) return "linear-gradient(90deg, #059669, #00e599)";
  if (ltv <= 66.7) return "linear-gradient(90deg, #ca8a04, #fde047)";
  return "linear-gradient(90deg, #b91c1c, #ef4444)";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.input-section { margin-bottom: $spacing-6; }

.tier-section {
  margin-bottom: $spacing-6;
}

.tier-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.tier-card {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
  text-align: center;
  transition: all 0.2s ease;
}

.tier-card.active {
  border-color: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.35);
  background: rgba(59, 130, 246, 0.12);
}

.tier-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  display: block;
}

.tier-percent {
  font-size: 16px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary);
  margin-top: 4px;
  display: block;
}

.tier-desc {
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.ltv-section-glass {
  margin-bottom: $spacing-6;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.ltv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.ltv-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ltv-value {
  font-size: 20px;
  font-weight: 900;
  font-family: $font-mono;
  &.safe { color: #00e599; text-shadow: 0 0 10px rgba(0, 229, 153, 0.3); }
  &.warning { color: #fde047; text-shadow: 0 0 10px rgba(253, 224, 71, 0.3); }
  &.danger { color: #ef4444; text-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
}

.ltv-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  position: relative;
  margin-bottom: 8px;
  overflow: hidden;
}

.ltv-fill-glass {
  height: 100%;
  border-radius: 4px;
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ltv-glimmer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transform: translateX(-100%);
  animation: glimmer 2s infinite;
}

.ltv-marker {
  position: absolute; top: 0; bottom: 0; width: 1px;
  background: rgba(255, 255, 255, 0.2);
  z-index: 1;
}

.ltv-labels {
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--text-secondary); font-weight: 600;
}

.calculator-receipt {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: $spacing-6;
}

.calc-row {
  display: flex; justify-content: space-between;
  margin-bottom: 8px;
}

.calc-label { font-size: 11px; color: var(--text-secondary); }

.calc-value {
  font-size: 12px; font-weight: 700; font-family: $font-mono;
  &.collateral-req { color: #fde047; }
  &.payment { color: #00e599; }
  &.fee { color: #f97316; }
  &.total { color: #3b82f6; }
}

.calc-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.borrow-btn { margin-top: 4px; }

.note-glass {
  display: block; margin-top: 12px;
  font-size: 10px; color: var(--text-secondary);
  text-align: center;
}

@keyframes glimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
