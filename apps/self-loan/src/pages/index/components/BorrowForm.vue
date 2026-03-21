<template>
  <NeoCard variant="erobo-neo" class="borrow-card">
    <div class="input-section">
      <NeoInput
        :modelValue="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
        type="number"
        :label="t('collateralAmount')"
        :placeholder="t('amountToLock')"
        :suffix="t('tokenNeo')"
      />
    </div>

    <div v-if="ltvOptions.length" class="tier-section">
      <span class="tier-label">{{ t("ltvTier") }}</span>
      <div class="tier-grid">
        <button
          type="button"
          v-for="option in ltvOptions"
          :key="option.tier"
          :class="['tier-card', { active: option.tier === selectedTier }]"
          @click="emit('update:selectedTier', option.tier)"
        >
          <span class="tier-title">{{ option.label }}</span>
          <span class="tier-percent">{{ option.percent }}%</span>
          <span v-if="option.desc" class="tier-desc">{{ option.desc }}</span>
        </button>
      </div>
    </div>

    <div class="ltv-section-glass">
      <div class="ltv-header">
        <span class="ltv-label">{{ t("loanToValue") }}</span>
        <span :class="['ltv-value', getLTVClass()]">{{ calculatedLTV }}%</span>
      </div>
      <div class="ltv-track">
        <div class="ltv-fill-glass" :class="getLTVColorClass()" :style="{ width: calculatedLTV + '%' }">
          <div class="ltv-glimmer"></div>
        </div>
        <div class="ltv-marker ltv-marker--half"></div>
        <div class="ltv-marker ltv-marker--two-thirds"></div>
      </div>
      <div class="ltv-labels">
        <span class="ltv-min">{{ t("ltvMin") }}</span>
        <span class="ltv-mid">{{ t("ltvMid") }}</span>
        <span class="ltv-max">{{ t("ltvMax") }}</span>
      </div>
    </div>

    <div class="calculator-receipt">
      <div class="calc-row">
        <span class="calc-label">{{ estimatedLabel }}</span>
        <span class="calc-value mono collateral-req">{{ fmt(estimatedBorrowNet, 2) }} {{ t("tokenGas") }}</span>
      </div>
      <div v-if="platformFeeBps > 0" class="calc-row">
        <span class="calc-label">{{ feeLabel }}</span>
        <span class="calc-value mono fee">{{ fmt(feeAmount, 2) }} {{ t("tokenGas") }}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">{{ t("collateralRatio") }}</span>
        <span class="calc-value mono payment">{{ fmt(collateralRatio, 2) }}x</span>
      </div>
      <div class="calc-divider"></div>
      <div class="calc-row total">
        <span class="calc-label">{{ t("minDuration") }}</span>
        <span class="calc-value mono total">{{ terms.minDurationHours }}h</span>
      </div>
    </div>

    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('takeLoan')" class="borrow-btn">
      <span>{{ isLoading ? t("processing") : t("borrowNow") }}</span>
    </NeoButton>
    <span class="note-glass">{{ t("note") }}</span>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber } from "@shared/utils/format";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";

const props = defineProps<{
  modelValue: string;
  terms: Record<string, unknown>;
  isLoading: boolean;
  ltvOptions: { tier: number; percent: number; label: string; desc?: string }[];
  selectedTier: number;
  platformFeeBps?: number;
  t: (key: string, ...args: unknown[]) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "update:selectedTier", tier: number): void;
  (e: "takeLoan"): void;
}>();

const fmt = (n: number, d = 2) => formatNumber(n, d);

const selectedOption = computed(() => props.ltvOptions.find((option) => option.tier === props.selectedTier));
const ltvPercent = computed(() => Number(selectedOption.value?.percent ?? props.terms?.ltvPercent ?? 20));
const collateralAmount = computed(() => parseFloat(props.modelValue || "0") || 0);
const estimatedBorrow = computed(() => (collateralAmount.value * ltvPercent.value) / 100);
const platformFeeBps = computed(() => Number(props.platformFeeBps ?? props.terms?.platformFeeBps ?? 0));
const feeAmount = computed(() => (estimatedBorrow.value * platformFeeBps.value) / 10000);
const estimatedBorrowNet = computed(() => Math.max(estimatedBorrow.value - feeAmount.value, 0));
const collateralRatio = computed(() => (ltvPercent.value > 0 ? 100 / ltvPercent.value : 0));
const feePercent = computed(() => (platformFeeBps.value / 100).toFixed(2).replace(/\.00$/, ""));
const feeLabel = computed(() => props.t("originationFee", { percent: feePercent.value }));
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

const getLTVColorClass = () => {
  const ltv = calculatedLTV.value;
  if (ltv <= 50) return "ltv-safe";
  if (ltv <= 66.7) return "ltv-warning";
  return "ltv-danger";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.input-section {
  margin-bottom: $spacing-6;
}

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
  appearance: none;
  cursor: pointer;
}

.tier-card.active {
  border-color: var(--checkbook-info);
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
  &.safe {
    color: var(--checkbook-success);
    text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  }
  &.warning {
    color: var(--checkbook-warning);
    text-shadow: 0 0 10px rgba(253, 224, 71, 0.3);
  }
  &.danger {
    color: var(--checkbook-danger);
    text-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }
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

  &.ltv-safe {
    background: linear-gradient(90deg, var(--checkbook-success-deep), var(--checkbook-success));
  }
  &.ltv-warning {
    background: linear-gradient(90deg, var(--checkbook-warning-deep), var(--checkbook-warning));
  }
  &.ltv-danger {
    background: linear-gradient(90deg, var(--checkbook-danger-deep), var(--checkbook-danger));
  }
}

.ltv-glimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: translateX(-100%);
  animation: glimmer 2s infinite;
}

.ltv-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.2);
  z-index: 1;

  &--half {
    left: 50%;
  }
  &--two-thirds {
    left: 66.7%;
  }
}

.ltv-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--text-secondary);
  font-weight: 600;
}

.calculator-receipt {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: $spacing-6;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.calc-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.calc-value {
  font-size: 12px;
  font-weight: 700;
  font-family: $font-mono;
  &.collateral-req {
    color: var(--checkbook-warning);
  }
  &.payment {
    color: var(--checkbook-success);
  }
  &.fee {
    color: var(--checkbook-orange);
  }
  &.total {
    color: var(--checkbook-info);
  }
}

.calc-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.borrow-btn {
  margin-top: 4px;
}

.note-glass {
  display: block;
  margin-top: 12px;
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
}

@keyframes glimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
