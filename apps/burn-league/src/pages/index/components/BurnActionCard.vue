<template>
  <NeoCard variant="erobo">
    <NeoInput
      :modelValue="burnAmount"
      @update:modelValue="$emit('update:burnAmount', $event)"
      type="number"
      :placeholder="t('amountPlaceholder')"
      :suffix="t('tokenGas')"
    />
    <div class="reward-info">
      <span class="reward-label">{{ t("estimatedRewards") }}</span>
      <span class="reward-value">+{{ formatNum(estimatedReward) }} {{ t("points") }}</span>
    </div>
    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('burn')" class="burn-button">
      <span class="burn-button-text"><AppIcon name="flame" :size="14" aria-hidden="true" /> {{ t("burnNow") }}</span>
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  burnAmount: string;
  estimatedReward: number;
  isLoading: boolean;
}>();

defineEmits<{
  (e: "update:burnAmount", value: string): void;
  (e: "burn"): void;
}>();

const formatNum = (n: number) => formatNumber(n, 2);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.reward-info {
  background: var(--burn-reward-bg);
  backdrop-filter: blur(10px);
  padding: 16px;
  border: 1px solid var(--burn-reward-border);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  box-shadow: 0 0 20px var(--burn-reward-border);
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
