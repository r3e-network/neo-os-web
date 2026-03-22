<template>
  <div>
    <div class="section-header">
      <span class="section-label">{{ t("forYou") }}</span>
      <span class="count-badge">{{ escrows.length }}</span>
    </div>
    <div v-if="escrows.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <span class="text-xs">{{ t("emptyEscrows") }}</span>
      </NeoCard>
    </div>
    <div v-for="escrow in escrows" :key="`beneficiary-${escrow.id}`" class="escrow-card">
      <div class="escrow-card__header">
        <div>
          <span class="escrow-title">{{ escrow.title || `#${escrow.id}` }}</span>
          <span class="escrow-subtitle">{{ formatAddressFunc(escrow.creator) }}</span>
        </div>
        <StatusBadge
          :status="escrow.status === 'completed' ? 'success' : escrow.status === 'cancelled' ? 'error' : 'active'"
          :label="statusLabelFunc(escrow.status)"
        />
      </div>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
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

const { t } = createUseI18n(messages)();

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
  background: var(--escrow-badge-bg);
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

.empty-state {
  margin-top: 10px;
}
</style>
