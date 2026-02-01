<template>
  <view class="trade-form">
    <text class="form-title">{{ t("placeTrade") }}</text>
    
    <view class="outcome-selector">
      <view
        :class="['outcome-btn', 'yes-btn', { active: selectedOutcome === 'yes' }]"
        @click="selectedOutcome = 'yes'"
      >
        <text class="outcome-label">{{ t("yes") }}</text>
        <text class="outcome-price">{{ market.yesPrice.toFixed(2) }} GAS</text>
      </view>
      <view
        :class="['outcome-btn', 'no-btn', { active: selectedOutcome === 'no' }]"
        @click="selectedOutcome = 'no'"
      >
        <text class="outcome-label">{{ t("no") }}</text>
        <text class="outcome-price">{{ market.noPrice.toFixed(2) }} GAS</text>
      </view>
    </view>
    
    <view class="input-group">
      <text class="input-label">{{ t("shares") }}</text>
      <NeoInput v-model="shares" type="number" :placeholder="t('sharesPlaceholder')" />
    </view>
    
    <view class="trade-summary">
      <text class="summary-label">{{ t("totalCost") }}</text>
      <text class="summary-value">{{ totalCost.toFixed(2) }} GAS</text>
    </view>
    
    <NeoButton
      variant="primary"
      size="lg"
      block
      :loading="isTrading"
      :disabled="!canTrade"
      @click="handleSubmit"
    >
      {{ isTrading ? t("trading") : t("trade") }}
    </NeoButton>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoButton, NeoInput } from "@shared/components";
import type { PredictionMarket } from "../composables/usePredictionMarkets";

interface Props {
  market: PredictionMarket;
  isTrading: boolean;
  t: Function;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  trade: [{ outcome: "yes" | "no"; shares: number; price: number }];
}>();

const selectedOutcome = ref<"yes" | "no">("yes");
const shares = ref("");

const totalCost = computed(() => {
  const numShares = Number.parseFloat(shares.value) || 0;
  const price = selectedOutcome.value === "yes" ? props.market.yesPrice : props.market.noPrice;
  return numShares * price;
});

const canTrade = computed(() => {
  const numShares = Number.parseFloat(shares.value);
  return Number.isFinite(numShares) && numShares > 0 && !props.isTrading;
});

const handleSubmit = () => {
  const numShares = Number.parseFloat(shares.value);
  const price = selectedOutcome.value === "yes" ? props.market.yesPrice : props.market.noPrice;
  emit("trade", { outcome: selectedOutcome.value, shares: numShares, price });
  shares.value = "";
};
</script>

<style lang="scss" scoped>
.trade-form {
  background: var(--pm-card-bg);
  border: 1px solid var(--pm-border);
  border-radius: 16px;
  padding: 20px;
}

.form-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--pm-text);
  margin-bottom: 20px;
  display: block;
}

.outcome-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.outcome-btn {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  
  &.yes-btn {
    background: rgba(16, 185, 129, 0.1);
    
    &.active {
      border-color: var(--pm-success);
      background: rgba(16, 185, 129, 0.2);
    }
  }
  
  &.no-btn {
    background: rgba(239, 68, 68, 0.1);
    
    &.active {
      border-color: var(--pm-danger);
      background: rgba(239, 68, 68, 0.2);
    }
  }
}

.outcome-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--pm-text);
  margin-bottom: 4px;
}

.outcome-price {
  display: block;
  font-size: 12px;
  color: var(--pm-text-secondary);
}

.input-group {
  margin-bottom: 20px;
}

.input-label {
  display: block;
  font-size: 12px;
  color: var(--pm-text-secondary);
  margin-bottom: 8px;
}

.trade-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  margin-bottom: 20px;
  border-top: 1px solid var(--pm-border);
}

.summary-label {
  font-size: 14px;
  color: var(--pm-text-secondary);
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--pm-text);
}
</style>
