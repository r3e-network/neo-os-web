<script setup lang="ts">
/**
 * StakeForm - TrustAnchor Stake/Unstake Form Component
 *
 * Provides stake and unstake input fields with validation.
 *
 * @example
 * ```vue
 * <StakeForm
 *   :address="address"
 *   :my-stake="100"
 *   :is-staking="false"
 *   :is-unstaking="false"
 *   @stake="handleStake"
 *   @unstake="handleUnstake"
 * />
 * ```
 */

interface Props {
  address: string | null;
  myStake: number;
  isStaking: boolean;
  isUnstaking: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "stake", amount: number): void;
  (e: "unstake", amount: number): void;
}>();

const { t } = useI18n();

const stakeAmount = ref("");
const unstakeAmount = ref("");

const handleStake = () => {
  const amount = parseFloat(stakeAmount.value);
  emit("stake", amount);
};

const handleUnstake = () => {
  const amount = parseFloat(unstakeAmount.value);
  emit("unstake", amount);
};
</script>

<template>
  <NeoCard variant="erobo" class="mb-4 px-1">
    <view class="section-header mb-4">
      <text class="section-title">{{ t("stake") }}</text>
    </view>

    <view v-if="address" class="stake-form">
      <view class="input-group mb-4">
        <text class="input-label">{{ t("stake NEO") }}</text>
        <view class="input-row">
          <input
            type="number"
            v-model="stakeAmount"
            class="amount-input"
            :placeholder="t('amount')"
          />
          <NeoButton variant="primary" :loading="isStaking" @click="handleStake">
            {{ t("stake") }}
          </NeoButton>
        </view>
      </view>

      <view class="input-group">
        <text class="input-label">{{ t("unstake") }}</text>
        <view class="input-row">
          <input
            type="number"
            v-model="unstakeAmount"
            class="amount-input"
            :placeholder="t('amount')"
          />
          <NeoButton variant="secondary" :loading="isUnstaking" @click="handleUnstake">
            {{ t("unstake") }}
          </NeoButton>
        </view>
      </view>
    </view>

    <view v-else class="connect-prompt">
      <NeoButton variant="primary" @click="connect">
        {{ t("connectWallet") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script lang="ts">
export default {
  name: "StakeForm",
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 12px;
  opacity: 0.7;
}

.input-row {
  display: flex;
  gap: 12px;
}

.amount-input {
  flex: 1;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
}

.connect-prompt {
  display: flex;
  justify-content: center;
  padding: 20px;
}
</style>
