<template>
  <NeoCard variant="erobo" class="mt-4">
    <view class="rewards-grid">
      <view class="reward-item">
        <text class="reward-value">{{ formatGas(unclaimedRewards) }}</text>
        <text class="reward-label">{{ t("unclaimed") }}</text>
      </view>
      <view class="reward-item">
        <text class="reward-value">{{ formatGas(totalClaimed) }}</text>
        <text class="reward-label">{{ t("totalClaimed") }}</text>
      </view>
    </view>
    <NeoButton
      v-if="unclaimedRewards > 0"
      variant="success"
      size="md"
      block
      :loading="isClaiming"
      @click="$emit('claim')"
      class="mt-4"
    >
      {{ t("claimRewards") }} ({{ formatGas(unclaimedRewards) }} GAS)
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

defineEmits(["claim"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.rewards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.reward-item {
  text-align: center;
  padding: 16px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
}

.reward-value {
  display: block;
  font-family: $font-mono;
  font-size: 24px;
  font-weight: 700;
  color: var(--sunrise-reward);
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  margin-bottom: 4px;
}

.reward-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
}
</style>
