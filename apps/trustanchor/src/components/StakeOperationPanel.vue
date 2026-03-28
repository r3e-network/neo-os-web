<template>
  <NeoCard variant="erobo" :title="t('stake')" class="mb-4 px-1">
    <div class="stake-form">
      <div class="input-group mb-4">
        <div class="input-row">
          <NeoInput type="number" v-model="stakeAmount" :label="t('stake')" :placeholder="t('amount')" required :min="0" />
          <NeoButton variant="primary" type="button" :loading="isStaking" :aria-label="t('stake')" @click="handleStake">
            {{ t("stake") }}
          </NeoButton>
        </div>
      </div>

      <div class="input-group mb-4">
        <div class="input-row">
          <NeoInput type="number" v-model="unstakeAmount" :label="t('unstake')" :placeholder="t('amount')" required :min="0" />
          <NeoButton variant="secondary" type="button" :loading="isUnstaking" :aria-label="t('unstake')" @click="handleUnstake">
            {{ t("unstake") }}
          </NeoButton>
        </div>
      </div>

      <div class="claim-panel">
        <div class="claim-panel__copy">
          <span class="claim-panel__label">{{ t("pendingRewards") }}</span>
          <span class="claim-panel__value">{{ formatNum(pendingRewards) }} {{ t("tokenGas") }}</span>
        </div>
        <NeoButton variant="primary" type="button" :loading="isClaiming" :disabled="pendingRewards <= 0" :aria-label="t('claim')" @click="handleClaim">
          {{ t("claim") }}
        </NeoButton>
      </div>

      <div class="claim-panel claim-panel--withdraw">
        <div class="claim-panel__copy">
          <span class="claim-panel__label">{{ t("pendingWithdrawLabel") }}</span>
          <span class="claim-panel__value">{{ formatNum(pendingWithdraw) }} {{ t("tokenNeo") }}</span>
          <span class="claim-panel__hint">{{ t("withdrawQueueDesc") }}</span>
        </div>
        <NeoButton variant="secondary" type="button" :disabled="pendingWithdraw <= 0" :aria-label="t('claimPendingWithdraw')" @click="handleClaimPendingWithdraw">
          {{ t("claimPendingWithdraw") }}
        </NeoButton>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, inject } from "vue";
import { NeoButton, NeoCard, NeoInput } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  pendingRewards: number;
  pendingWithdraw: number;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
const formatNum = (n: number | string) => formatNumber(n, 2);

const isStaking = ref(false);
const isUnstaking = ref(false);
const isClaiming = ref(false);
const stakeAmount = ref("");
const unstakeAmount = ref("");

const handleStake = async () => {
  const amount = parseInt(stakeAmount.value, 10);
  if (!amount || amount <= 0) return;
  isStaking.value = true;
  try {
    const handler = actions.get("stake");
    if (handler) await handler(amount);
    stakeAmount.value = "";
  } finally {
    isStaking.value = false;
  }
};

const handleUnstake = async () => {
  const amount = parseInt(unstakeAmount.value, 10);
  if (!amount || amount <= 0) return;
  isUnstaking.value = true;
  try {
    const handler = actions.get("unstake");
    if (handler) await handler(amount);
    unstakeAmount.value = "";
  } finally {
    isUnstaking.value = false;
  }
};

const handleClaim = async () => {
  if (props.pendingRewards <= 0) return;
  isClaiming.value = true;
  try {
    const handler = actions.get("claimRewards");
    if (handler) await handler();
  } finally {
    isClaiming.value = false;
  }
};

const handleClaimPendingWithdraw = async () => {
  if (props.pendingWithdraw <= 0) return;
  const handler = actions.get("claimPendingWithdraw");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 12px;
}

.claim-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.claim-panel__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.claim-panel__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.6;
}

.claim-panel__value {
  font-size: 18px;
  font-weight: 800;
}

.claim-panel__hint {
  font-size: 10px;
  opacity: 0.5;
}

@media (max-width: 767px) {
  .input-row {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
