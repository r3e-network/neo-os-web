<template>
  <ContractAvailabilityCard
    v-if="!contractReady"
    :title="t('deploymentPendingTitle')"
    :description="t('deploymentPendingDesc')"
    :t="t"
  />
  <template v-else>
    <div class="escrows-header">
      <span class="section-title">{{ t("escrowsTab") }}</span>
      <NeoButton size="sm" variant="secondary" type="button" :loading="isRefreshing" :aria-label="t('refresh')" @click="$emit('refresh')">
        {{ t("refresh") }}
      </NeoButton>
    </div>

    <div v-if="!hasAddress" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" type="button" :aria-label="t('connectWallet')" @click="$emit('connectWallet')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <EscrowList
      v-else
      :creator-escrows="creatorEscrows"
      :beneficiary-escrows="beneficiaryEscrows"
      :approving-id="approvingId"
      :cancelling-id="cancellingId"
      :claiming-id="claimingId"
      :status-label-func="statusLabelFunc"
      :format-amount-func="formatAmountFunc"
      :format-address-func="formatAddressFunc"
      @approve="$emit('approve', $event)"
      @cancel="$emit('cancel', $event)"
      @claim="$emit('claim', $event)"
    />
  </template>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, ContractAvailabilityCard } from "@shared/components";
import EscrowList from "../pages/index/components/EscrowList.vue";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  contractReady: boolean;
  isRefreshing: boolean;
  hasAddress: boolean;
  creatorEscrows: unknown[];
  beneficiaryEscrows: unknown[];
  approvingId: string;
  cancellingId: string;
  claimingId: string;
  statusLabelFunc: Function;
  formatAmountFunc: Function;
  formatAddressFunc: Function;
}>();

defineEmits<{
  refresh: [];
  connectWallet: [];
  approve: [escrow: unknown];
  cancel: [escrow: unknown];
  claim: [escrow: unknown];
}>();
</script>

<style lang="scss" scoped>
.escrows-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
}
</style>
