<template>
  <NeoCard variant="erobo">
    <text class="card-title-glass">{{ t("buyKeys") }}</text>
    <NeoInput
      :modelValue="keyCount"
      @update:modelValue="$emit('update:keyCount', $event)"
      type="number"
      :placeholder="t('keyCountPlaceholder')"
      suffix="Keys"
    />
    <view class="cost-row-glass">
      <text class="cost-label-glass">{{ t("estimatedCost") }}</text>
      <text class="cost-value-glass">{{ estimatedCost }} GAS</text>
    </view>
    <text class="hint-text-glass">{{ t("keyPrice") }}</text>
    <NeoButton variant="primary" size="lg" block @click="$emit('buy')" :disabled="isPaying">
      {{ isPaying ? t("buying") : t("buyKeys") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

defineProps<{
  keyCount: string;
  estimatedCost: string;
  isPaying: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits(["update:keyCount", "buy"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.card-title-glass {
  font-size: 14px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: $spacing-4;
  padding-bottom: $spacing-2;
  display: block;
  color: var(--text-primary);
  letter-spacing: 0.1em;
}

.cost-row-glass {
  display: flex;
  justify-content: space-between;
  margin: $spacing-4 0;
  padding: $spacing-3;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.cost-label-glass {
  font-size: 12px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-primary);
}
.cost-value-glass {
  font-size: 18px;
  font-weight: $font-weight-bold;
  font-family: $font-mono;
  color: var(--doom-success);
}

.hint-text-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  opacity: 0.6;
  display: block;
  margin-bottom: $spacing-4;
  color: var(--text-secondary);
  text-align: center;
}
</style>
