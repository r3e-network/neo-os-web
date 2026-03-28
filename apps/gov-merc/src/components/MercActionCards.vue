<template>
  <!-- Deposit Card -->
  <NeoCard class="mb-6" variant="erobo">
    <div class="form-group-neo">
      <NeoInput v-model="localDepositAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenNeo')" :label="t('depositAmount')" :min="0" />
      <NeoButton type="button" variant="primary" size="lg" block :loading="isBusy" @click="handleDeposit">
        {{ t("depositNeo") }}
      </NeoButton>
    </div>
  </NeoCard>

  <!-- Withdraw Card -->
  <NeoCard class="mb-6" variant="erobo">
    <div class="form-group-neo">
      <NeoInput v-model="localWithdrawAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenNeo')" :label="t('withdrawAmount')" :min="0" />
      <NeoButton type="button" variant="secondary" size="lg" block :loading="isBusy" @click="handleWithdraw">
        {{ t("withdrawNeo") }}
      </NeoButton>
    </div>
  </NeoCard>

  <!-- Bid Card -->
  <NeoCard variant="erobo" :title="t('placeBid')" class="mb-6">
    <div class="form-group-neo">
      <NeoInput v-model="localBidAmount" type="number" :placeholder="t('enterAmount')" :suffix="t('tokenGas')" :label="t('bidAmount')" :min="0" />
      <NeoButton type="button" variant="primary" size="lg" block :loading="isBusy" @click="handleBid">
        {{ t("placeBid") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, watch, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  depositAmountRef: Ref<string> | undefined;
  withdrawAmountRef: Ref<string> | undefined;
  bidAmountRef: Ref<string> | undefined;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// Local form state synced to composable refs
const localDepositAmount = ref("");
const localWithdrawAmount = ref("");
const localBidAmount = ref("");

watch(localDepositAmount, (val) => {
  if (props.depositAmountRef) props.depositAmountRef.value = val;
});
watch(localWithdrawAmount, (val) => {
  if (props.withdrawAmountRef) props.withdrawAmountRef.value = val;
});
watch(localBidAmount, (val) => {
  if (props.bidAmountRef) props.bidAmountRef.value = val;
});

const handleDeposit = async () => {
  const handler = actions.get("depositNeo");
  if (handler) {
    await handler();
    localDepositAmount.value = "";
  }
};

const handleWithdraw = async () => {
  const handler = actions.get("withdrawNeo");
  if (handler) {
    await handler();
    localWithdrawAmount.value = "";
  }
};

const handleBid = async () => {
  const handler = actions.get("placeBid");
  if (handler) {
    await handler();
    localBidAmount.value = "";
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/gov-merc-theme.scss" as *;

.form-group-neo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
