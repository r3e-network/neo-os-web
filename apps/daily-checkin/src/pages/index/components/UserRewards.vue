<template>
  <NeoCard variant="erobo" class="mt-4">
    <div class="rewards-grid">
      <div class="reward-item">
        <span class="reward-value">{{ formatGas(unclaimedRewards) }}</span>
        <span class="reward-label">{{ t("unclaimed") }}</span>
      </div>
      <div class="reward-item">
        <span class="reward-value">{{ formatGas(totalClaimed) }}</span>
        <span class="reward-label">{{ t("totalClaimed") }}</span>
      </div>
    </div>
    <NeoButton
      v-if="unclaimedRewards > 0"
      variant="success"
      size="md"
      block
      type="button"
      :loading="isClaiming"
      @click="$emit('claim')"
      class="mt-4"
    >
      {{ t("claimRewards") }} ({{ formatGas(unclaimedRewards) }} {{ t("tokenGas") }})
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  unclaimedRewards: number;
  totalClaimed: number;
  isClaiming: boolean;
}>();

defineEmits<{
  (e: "claim"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.rewards-grid {
  @include grid-layout(2, 16px);
}

.reward-item {
  @include card-base(12px, 16px);
  text-align: center;
}

.reward-value {
  @include stat-value;
  font-size: 24px;
  color: var(--sunrise-reward);
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  margin-bottom: 4px;
}

.reward-label {
  @include stat-label;
  display: block;
  font-weight: 600;
}
</style>
