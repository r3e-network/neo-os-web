<template>
  <div class="milestone-list">
    <div
      v-for="(amount, index) in escrow.milestoneAmounts"
      :key="`${escrow.id}-${index}`"
      class="milestone-item"
    >
      <div>
        <span class="milestone-label">{{ t("idPrefix") }}{{ index + 1 }}</span>
        <span class="milestone-amount">{{ formatAmountFunc(escrow.assetSymbol, amount) }} {{ escrow.assetSymbol }}</span>
      </div>
      <div class="milestone-actions">
        <span class="milestone-status">{{ statusText }}</span>
        <NeoButton
          v-if="showApprove"
          size="sm"
          variant="secondary"
          type="button"
          :loading="approvingId === `${escrow.id}-${index + 1}`"
          :disabled="!escrow.active || escrow.milestoneApproved[index] || escrow.milestoneClaimed[index]"
          :aria-label="approvingId === `${escrow.id}-${index + 1}` ? t('approving') : t('approve')"
          @click="onApprove(index)"
        >
          {{ approvingId === `${escrow.id}-${index + 1}` ? t("approving") : t("approve") }}
        </NeoButton>
        <NeoButton
          v-if="showClaim"
          size="sm"
          variant="primary"
          type="button"
          :loading="claimingId === `${escrow.id}-${index + 1}`"
          :disabled="!escrow.active || !escrow.milestoneApproved[index] || escrow.milestoneClaimed[index]"
          :aria-label="claimingId === `${escrow.id}-${index + 1}` ? t('claiming') : t('claim')"
          @click="onClaim(index)"
        >
          {{ claimingId === `${escrow.id}-${index + 1}` ? t("claiming") : t("claim") }}
        </NeoButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
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

const { t } = createUseI18n(messages)();

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
  background: var(--escrow-milestone-bg);
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
