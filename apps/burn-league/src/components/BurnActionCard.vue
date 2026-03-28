<template>
  <NeoCard variant="erobo" class="burn-action-card">
    <NeoInput
      :modelValue="burnAmount"
      type="number"
      :placeholder="t('amountPlaceholder')"
      :suffix="t('tokenGas')"
      @update:modelValue="$emit('update:burnAmount', $event)"
    />
    <div class="reward-info">
      <span class="reward-label">{{ t("estimatedRewards") }}</span>
      <span class="reward-value">+{{ formatNum(estimatedReward) }} {{ t("points") }}</span>
    </div>
    <NeoButton
      variant="primary"
      size="lg"
      block
      type="button"
      :disabled="isBurning"
      :loading="isBurning"
      class="burn-button"
      @click="$emit('burn')"
    >
      <span class="burn-button-text">
        <AppIcon name="flame" :size="14" aria-hidden="true" />
        {{ t("burnNow") }}
      </span>
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { AppIcon, NeoCard, NeoInput, NeoButton } from "@shared/components";
import { formatNum } from "../composables/useBurnLeague";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  burnAmount: string;
  estimatedReward: number;
  isBurning: boolean;
}>();

defineEmits<{
  "update:burnAmount": [value: string];
  burn: [];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.burn-action-card {
  width: 100%;
  max-width: 400px;
}

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
  color: var(--burn-orange, #ff4500);
  text-shadow: 0 0 10px rgba(249, 115, 22, 0.3);
}

.burn-button {
  margin-top: 16px;
}

.burn-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
