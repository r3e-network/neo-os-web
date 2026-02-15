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
import { formatNumber } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  burnAmount: string;
  estimatedReward: number;
  isLoading: boolean;
}>();

defineEmits(["update:burnAmount", "burn"]);

const formatNum = (n: number) => formatNumber(n, 2);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

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
  @include stat-label;
}

.reward-value {
  font-size: 14px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--burn-orange);
  text-shadow: 0 0 10px rgba(249, 115, 22, 0.3);
}

.burn-button-text {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
