<template>
  <view>
    <view class="section-header">
      <text class="section-label">{{ t("forYou") }}</text>
      <text class="count-badge">{{ escrows.length }}</text>
    </view>
    <view v-if="escrows.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyEscrows") }}</text>
      </NeoCard>
    </view>
    <view v-for="escrow in escrows" :key="`beneficiary-${escrow.id}`" class="escrow-card">
      <view class="escrow-card__header">
        <view>
          <text class="escrow-title">{{ escrow.title || `#${escrow.id}` }}</text>
          <text class="escrow-subtitle">{{ formatAddressFunc(escrow.creator) }}</text>
        </view>
        <text :class="['status-pill', escrow.status]">{{ statusLabelFunc(escrow.status) }}</text>
      </view>

      <MilestoneProgress
        :escrow="escrow"
        :status-label-func="statusLabelFunc"
        :format-amount-func="formatAmountFunc"
        :status-text="{
          claimed: t('claimed'),
          approved: t('approved'),
          pending: t('pending'),
        }"
        :show-approve="false"
        :claiming-id="claimingId"
        @claim="onClaim"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import MilestoneProgress from "./MilestoneProgress.vue";
import type { EscrowItem } from "./EscrowList.vue";

defineProps<{
  escrows: EscrowItem[];
  claimingId: string | null;
  statusLabelFunc: (status: string) => string;
  formatAmountFunc: (symbol: string, amount: bigint) => string;
  formatAddressFunc: (addr: string) => string;
}>();

const emit = defineEmits<{
  (e: "claim", escrow: EscrowItem, index: number): void;
}>();

const { t } = useI18n();

const onClaim = (escrow: EscrowItem, index: number) => emit("claim", escrow, index);
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
}

.count-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.2);
  color: var(--escrow-accent);
  font-size: 11px;
  font-weight: 700;
}

.escrow-card {
  background: var(--escrow-card-bg);
  border: 1px solid var(--escrow-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.escrow-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.escrow-title {
  font-size: 15px;
  font-weight: 700;
}

.escrow-subtitle {
  display: block;
  font-size: 11px;
  color: var(--escrow-muted);
  margin-top: 2px;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(245, 158, 11, 0.2);
  color: var(--escrow-accent);
}

.status-pill.completed {
  background: rgba(34, 197, 94, 0.2);
  color: var(--escrow-completed);
}

.status-pill.cancelled {
  background: rgba(248, 113, 113, 0.2);
  color: var(--escrow-cancelled);
}

.empty-state {
  margin-top: 10px;
}
</style>
