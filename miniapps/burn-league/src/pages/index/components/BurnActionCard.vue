<template>
  <NeoCard variant="erobo">
    <NeoInput
      :modelValue="burnAmount"
      @update:modelValue="$emit('update:burnAmount', $event)"
      type="number"
      :placeholder="t('amountPlaceholder')"
      suffix="GAS"
    />
    <view class="reward-info">
      <text class="reward-label">{{ t("estimatedRewards") }}</text>
      <text class="reward-value">+{{ formatNum(estimatedReward) }} {{ t("points") }}</text>
    </view>
    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('burn')" class="burn-button">
      <text class="burn-button-text">🔥 {{ t("burnNow") }}</text>
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  burnAmount: string;
  estimatedReward: number;
  isLoading: boolean;
  t: (key: string) => string;
}>();

defineEmits(["update:burnAmount", "burn"]);

const formatNum = (n: number) => {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.reward-info {
  background: rgba(249, 115, 22, 0.1);
  backdrop-filter: blur(10px);
  padding: 16px;
  border: 1px solid rgba(249, 115, 22, 0.2);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.1);
}

.reward-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  letter-spacing: 0.1em;
}

.reward-value {
  font-size: 14px;
  font-weight: 800;
  font-family: $font-family;
  color: #F97316;
  text-shadow: 0 0 10px rgba(249, 115, 22, 0.3);
}

.burn-button-text {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
