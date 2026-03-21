<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@shared/composables/useI18n";

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
  if (Number.isNaN(amount) || amount <= 0) return;
  emit("stake", amount);
};

const handleUnstake = () => {
  const amount = parseFloat(unstakeAmount.value);
  if (Number.isNaN(amount) || amount <= 0) return;
  emit("unstake", amount);
};
</script>

<template>
  <NeoCard variant="erobo" class="mb-4 px-1">
    <div class="section-header mb-4">
      <span class="section-title">{{ t("stake") }}</span>
    </div>

    <div v-if="address" class="stake-form">
      <div class="input-group mb-4">
        <span class="input-label">{{ t("stake") }}</span>
        <div class="input-row">
          <input
            type="number"
            v-model="stakeAmount"
            class="amount-input"
            :placeholder="t('amount')"
            :aria-label="t('stake')"
          />
          <NeoButton variant="primary" type="button" :loading="isStaking" @click="handleStake" :aria-label="t('stake')">
            {{ t("stake") }}
          </NeoButton>
        </div>
      </div>

      <div class="input-group">
        <span class="input-label">{{ t("unstake") }}</span>
        <div class="input-row">
          <input
            type="number"
            v-model="unstakeAmount"
            class="amount-input"
            :placeholder="t('amount')"
            :aria-label="t('unstake')"
          />
          <NeoButton variant="secondary" type="button" :loading="isUnstaking" @click="handleUnstake" :aria-label="t('unstake')">
            {{ t("unstake") }}
          </NeoButton>
        </div>
      </div>
    </div>

    <div v-else class="connect-prompt">
      <NeoButton variant="primary" type="button" @click="requestWallet()" :aria-label="t('connectWallet')">
        {{ t("connectWallet") }}
      </NeoButton>
    </div>
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
  color: var(--text-primary, white);
}

.connect-prompt {
  display: flex;
  justify-content: center;
  padding: 20px;
}
</style>
