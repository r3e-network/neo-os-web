<template>
  <view class="milestone-list">
    <view
      v-for="(amount, index) in escrow.milestoneAmounts"
      :key="`milestone-${escrow.id}-${index}`"
      class="milestone-item"
    >
      <view>
        <text class="milestone-label">#{{ index + 1 }}</text>
        <text class="milestone-amount">{{ formatAmountFunc(escrow.assetSymbol, amount) }} {{ escrow.assetSymbol }}</text>
      </view>
      <view class="milestone-actions">
        <text class="milestone-status">{{ statusText }}</text>
        <NeoButton
          v-if="showApprove"
          size="sm"
          variant="secondary"
          :loading="approvingId === `${escrow.id}-${index + 1}`"
          :disabled="!escrow.active || escrow.milestoneApproved[index] || escrow.milestoneClaimed[index]"
          @click="onApprove(index)"
        >
          {{ approvingId === `${escrow.id}-${index + 1}` ? t("approving") : t("approve") }}
        </NeoButton>
        <NeoButton
          v-if="showClaim"
          size="sm"
          variant="primary"
          :loading="claimingId === `${escrow.id}-${index + 1}`"
          :disabled="!escrow.active || !escrow.milestoneApproved[index] || escrow.milestoneClaimed[index]"
          @click="onClaim(index)"
        >
          {{ claimingId === `${escrow.id}-${index + 1}` ? t("claiming") : t("claim") }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import type { EscrowItem } from "./EscrowList.vue";

const props = defineProps<{
  escrow: EscrowItem;
  statusLabelFunc: (status: string) => string;
  formatAmountFunc: (symbol: string, amount: bigint) => string;
  statusText: {
    claimed: string;
    approved: string;
    pending: string;
  };
  showApprove?: boolean;
  showClaim?: boolean;
  approvingId?: string | null;
  claimingId?: string | null;
}>();

const emit = defineEmits<{
  (e: "approve", index: number): void;
  (e: "claim", index: number): void;
}>();

const { t } = useI18n();

const statusText = computed(() => {
  const idx = props.escrow.milestoneAmounts.length - 1;
  if (props.escrow.milestoneClaimed[idx]) return props.statusText.claimed;
  if (props.escrow.milestoneApproved[idx]) return props.statusText.approved;
  return props.statusText.pending;
});

const onApprove = (index: number) => emit("approve", index);
const onClaim = (index: number) => emit("claim", index);
</script>

<style lang="scss" scoped>
.milestone-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.milestone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.2);
  border-radius: 12px;
  padding: 10px 12px;
}

.milestone-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--escrow-muted);
}

.milestone-amount {
  font-size: 13px;
  font-weight: 700;
}

.milestone-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.milestone-status {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--escrow-muted);
}
</style>
