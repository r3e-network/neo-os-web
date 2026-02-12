<template>
  <view class="loan-request">
    <!-- Wallet Connection Prompt -->
    <view v-if="!isConnected" class="wallet-prompt mb-4">
      <NeoCard variant="warning" class="text-center">
        <text class="mb-2 block font-bold">{{ t("connectWalletToUse") }}</text>
        <NeoButton variant="primary" size="sm" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </view>

    <!-- Instruction Mode Banner -->
    <NeoCard variant="warning" class="mb-4 text-center">
      <text class="text-glass-glow block font-bold">{{ t("instructionMode") }}</text>
      <text class="text-glass text-xs opacity-80">{{ t("instructionNote") }}</text>
    </NeoCard>

    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
      <text class="text-glass font-bold">{{ status.msg }}</text>
    </NeoCard>

    <LoanRequestForm
      v-model:loanId="loanId"
      :loan-details="loanDetails"
      :is-loading="isLoading"
      :validation-error="validationError"
      :is-connected="isConnected"
      :t="t"
      @lookup="$emit('lookup')"
      @request-loan="$emit('requestLoan', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import LoanRequestForm from "./LoanRequestForm.vue";

defineProps<{
  loanId: string;
  loanDetails: Record<string, unknown> | null;
  isLoading: boolean;
  validationError: string | null;
  isConnected: boolean;
  status: { msg: string; type: string } | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  connect: [];
  lookup: [];
  requestLoan: [data: { amount: string; callbackContract: string; callbackMethod: string }];
  "update:loanId": [value: string];
}>();
</script>

<style lang="scss" scoped>
.loan-request {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wallet-prompt {
  padding: 0 24px;
}

.mb-4 {
  margin-bottom: 16px;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
}

.block {
  display: block;
}

.text-xs {
  font-size: 12px;
}

.opacity-80 {
  opacity: 0.8;
}

.text-glass-glow {
  text-shadow: 0 0 10px var(--flash-glow);
  color: var(--flash-text);
}

.text-glass {
  color: var(--flash-text-muted);
}
</style>
