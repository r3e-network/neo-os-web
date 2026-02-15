<template>
  <NeoCard variant="erobo-neo">
    <view class="rewards-row">
      <view class="reward-info">
        <text class="reward-label">{{ t("pendingRewards") }}</text>
        <text class="reward-value">{{ formattedPendingRewards }}</text>
      </view>
      <NeoButton
        variant="primary"
        size="md"
        :disabled="pendingRewardsValue <= 0 || hasClaimed || isLoading"
        :loading="isLoading"
        @click="$emit('claim')"
      >
        {{ t("claimRewards") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  pendingRewardsValue: number;
  hasClaimed: boolean;
  isLoading: boolean;
}>();

defineEmits(["claim"]);

const { t } = createUseI18n(messages)();

const formatToken = (value: number, decimals = 4) => {
  if (!Number.isFinite(value)) return "0";
  const formatted = value.toFixed(decimals);
  return formatted.replace(/\.?0+$/, "");
};

const formattedPendingRewards = computed(() => `${formatToken(props.pendingRewardsValue)} GAS`);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.rewards-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.reward-info {
  display: flex;
  flex-direction: column;
}

.reward-label {
  @include stat-label;
  margin-bottom: 4px;
}

.reward-value {
  font-size: 28px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--candidate-neo-green);
  text-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
  letter-spacing: -0.02em;
}
</style>
