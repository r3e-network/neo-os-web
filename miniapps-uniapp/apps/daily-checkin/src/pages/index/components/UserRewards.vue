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
