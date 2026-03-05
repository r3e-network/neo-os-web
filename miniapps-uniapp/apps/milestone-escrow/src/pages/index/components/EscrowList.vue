<template>
  <view class="escrow-list">
    <CreatorEscrowSection
      :escrows="creatorEscrows"
      :status-label-func="statusLabel"
      :format-amount-func="formatAmount"
      :format-address-func="formatAddress"
      :approving-id="approvingId"
      :cancelling-id="cancellingId"
      @approve="onApprove"
      @cancel="onCancel"
    />

    <BeneficiaryEscrowSection
      :escrows="beneficiaryEscrows"
      :status-label-func="statusLabel"
      :format-amount-func="formatAmount"
      :format-address-func="formatAddress"
      :claiming-id="claimingId"
      @claim="onClaim"
    />
  </view>
</template>

<script setup lang="ts">
import CreatorEscrowSection from "./CreatorEscrowSection.vue";
import BeneficiaryEscrowSection from "./BeneficiaryEscrowSection.vue";

export interface EscrowItem {
  id: string;
  creator: string;
  beneficiary: string;
  assetSymbol: "NEO" | "GAS";
  totalAmount: bigint;
  releasedAmount: bigint;
  status: "active" | "completed" | "cancelled";
  milestoneAmounts: bigint[];
  milestoneApproved: boolean[];
  milestoneClaimed: boolean[];
  title: string;
  notes: string;
  active: boolean;
}

const props = defineProps<{
  creatorEscrows: EscrowItem[];
  beneficiaryEscrows: EscrowItem[];
  approvingId: string | null;
  cancellingId: string | null;
  claimingId: string | null;
  statusLabel: (status: string) => string;
  formatAmount: (symbol: string, amount: bigint) => string;
  formatAddress: (addr: string) => string;
}>();

const emit = defineEmits<{
  (e: "approve", escrow: EscrowItem, index: number): void;
  (e: "cancel", escrow: EscrowItem): void;
  (e: "claim", escrow: EscrowItem, index: number): void;
}>();

const onApprove = (escrow: EscrowItem, index: number) => emit("approve", escrow, index);
const onCancel = (escrow: EscrowItem) => emit("cancel", escrow);
const onClaim = (escrow: EscrowItem, index: number) => emit("claim", escrow, index);
</script>

<style lang="scss" scoped>
.escrow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
