<template>
  <view>
    <view class="section-header">
      <text class="section-label">{{ t("createdByYou") }}</text>
      <text class="count-badge">{{ escrows.length }}</text>
    </view>
    <view v-if="escrows.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyEscrows") }}</text>
      </NeoCard>
    </view>
    <view v-for="escrow in escrows" :key="`creator-${escrow.id}`" class="escrow-card">
      <view class="escrow-card__header">
        <view>
          <text class="escrow-title">{{ escrow.title || `#${escrow.id}` }}</text>
          <text class="escrow-subtitle">{{ formatAddressFunc(escrow.beneficiary) }}</text>
        </view>
        <StatusBadge
          :status="escrow.status === 'completed' ? 'success' : escrow.status === 'cancelled' ? 'error' : 'active'"
          :label="statusLabelFunc(escrow.status)"
        />
      </view>
      <view class="escrow-metrics">
        <view>
          <text class="metric-label">{{ t("totalAmount") }}</text>
          <text class="metric-value"
            >{{ formatAmountFunc(escrow.assetSymbol, escrow.totalAmount) }} {{ escrow.assetSymbol }}</text
          >
        </view>
        <view>
          <text class="metric-label">{{ t("claimed") }}</text>
          <text class="metric-value"
            >{{ formatAmountFunc(escrow.assetSymbol, escrow.releasedAmount) }} {{ escrow.assetSymbol }}</text
          >
        </view>
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
      />

      <view class="escrow-actions">
        <NeoButton
          size="sm"
          variant="secondary"
          :loading="cancellingId === escrow.id"
          :disabled="!escrow.active"
          @click="onCancel(escrow)"
        >
          {{ cancellingId === escrow.id ? t("cancelling") : t("cancel") }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import MilestoneProgress from "./MilestoneProgress.vue";
import type { EscrowItem } from "./EscrowList.vue";

defineProps<{
  escrows: EscrowItem[];
  approvingId: string | null;
  cancellingId: string | null;
  statusLabelFunc: (status: string) => string;
  formatAmountFunc: (symbol: string, amount: bigint) => string;
  formatAddressFunc: (addr: string) => string;
}>();

const emit = defineEmits<{
  (e: "approve", escrow: EscrowItem, index: number): void;
  (e: "cancel", escrow: EscrowItem): void;
}>();

const { t } = createUseI18n(messages)();

const onCancel = (escrow: EscrowItem) => emit("cancel", escrow);
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
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

.escrow-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.metric-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--escrow-muted);
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
}

.escrow-actions {
  display: flex;
  gap: 10px;
}

.empty-state {
  margin-top: 10px;
}
</style>
