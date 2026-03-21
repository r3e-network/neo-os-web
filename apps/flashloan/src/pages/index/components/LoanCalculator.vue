<template>
  <div class="loan-calculator">
    <NeoCard variant="erobo" class="calculator-card">
      <span class="calculator-title">{{ t('loanCalculator') }}</span>
      <div class="calculator-inputs">
        <div class="input-group">
          <span class="input-label">{{ t('loanAmount') }}</span>
          <input
            type="number"
            v-model="amount"
            class="calculator-input"
            :placeholder="t('enterAmount')"
            :aria-label="t('loanAmount')"
          />
        </div>
        <div class="input-group">
          <span class="input-label">{{ t('duration') }} ({{ t('days') }})</span>
          <input
            type="number"
            v-model="duration"
            class="calculator-input"
            :placeholder="t('enterDuration')"
            :aria-label="t('duration')"
          />
        </div>
      </div>
      <div class="calculator-results" v-if="calculatedFee > 0">
        <div class="result-item">
          <span class="result-label">{{ t('estimatedFee') }}</span>
          <span class="result-value">{{ formatGas(calculatedFee) }} {{ t("tokenGas") }}</span>
        </div>
        <div class="result-item">
          <span class="result-label">{{ t('totalRepayment') }}</span>
          <span class="result-value">{{ formatGas(calculatedTotal) }} {{ t("tokenGas") }}</span>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard } from "@shared/components";
import { formatGas } from "@shared/utils/format";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const amount = ref("");
const duration = ref("");
const feeRate = 0.001; // 0.1% fee rate

const calculatedFee = computed(() => {
  const amt = parseFloat(amount.value);
  const days = parseInt(duration.value, 10);
  if (isNaN(amt) || isNaN(days) || amt <= 0 || days <= 0) return 0;
  return amt * feeRate * days;
});

const calculatedTotal = computed(() => {
  const amt = parseFloat(amount.value);
  if (isNaN(amt) || amt <= 0) return 0;
  return amt + calculatedFee.value;
});
</script>

<style lang="scss" scoped>
.loan-calculator {
  margin-bottom: 16px;
}

.calculator-card {
  padding: 20px;
}

.calculator-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--flash-text);
}

.calculator-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  color: var(--flash-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.calculator-input {
  padding: 12px;
  border: 1px solid var(--flash-panel-border);
  border-radius: 4px;
  background: var(--flash-panel);
  color: var(--flash-text);
  font-family: "Consolas", "Monaco", monospace;
}

.calculator-results {
  border-top: 1px solid var(--flash-panel-border);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-label {
  font-size: 12px;
  color: var(--flash-text-muted);
}

.result-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--flash-accent-cyan);
  font-family: "Consolas", "Monaco", monospace;
}
</style>
