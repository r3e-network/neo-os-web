<template>
  <view class="vault-card">
    <view class="vault-card__header">
      <view>
        <text class="vault-title">{{ stream.title || `#${stream.id}` }}</text>
        <text class="vault-subtitle">{{ formatAddress(stream.isCreator ? stream.beneficiary : stream.creator) }}</text>
      </view>
      <text :class="['status-pill', stream.status]">{{ statusLabel(stream.status) }}</text>
    </view>

    <view class="vault-metrics">
      <view v-for="metric in metrics" :key="metric.label">
        <text class="metric-label">{{ metric.label }}</text>
        <text class="metric-value">
          {{ formatAmount(stream.assetSymbol, metric.value) }} {{ stream.assetSymbol }}
        </text>
      </view>
    </view>

    <view class="vault-meta">
      <text class="meta-item">{{ t("intervalLabel") }}: {{ stream.intervalDays }}d</text>
      <text class="meta-item">
        {{ t("rateLabel") }}: {{ formatAmount(stream.assetSymbol, stream.rateAmount) }}
        {{ stream.assetSymbol }}
      </text>
    </view>

    <view class="vault-actions">
      <slot name="actions" :stream="stream" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatGas, formatAddress } from "@shared/utils/format";
import type { StreamItem, StreamStatus } from "@/types";

const props = defineProps<{
  stream: StreamItem;
  isCreator?: boolean;
}>();

const { t } = createUseI18n(messages)();

const metrics = computed(() => {
  if (props.isCreator) {
    return [
      { label: t("totalLocked"), value: props.stream.totalAmount },
      { label: t("released"), value: props.stream.releasedAmount },
      { label: t("remaining"), value: props.stream.remainingAmount },
    ];
  }
  return [
    { label: t("claimable"), value: props.stream.claimable },
    { label: t("remaining"), value: props.stream.remainingAmount },
  ];
});

const formatAmount = (assetSymbol: "NEO" | "GAS", amount: bigint) => {
  if (assetSymbol === "NEO") return amount.toString();
  return formatGas(amount, 4);
};

const statusLabel = (statusValue: StreamStatus) => {
  if (statusValue === "completed") return t("statusCompleted");
  if (statusValue === "cancelled") return t("statusCancelled");
  return t("statusActive");
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.vault-card {
  background: var(--stream-card-bg);
  border: 1px solid var(--stream-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vault-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.vault-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--stream-text);
}

.vault-subtitle {
  display: block;
  font-size: 11px;
  color: var(--stream-muted);
  margin-top: 2px;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(56, 189, 248, 0.2);
  color: var(--stream-accent);
}

.status-pill.completed {
  background: rgba(34, 197, 94, 0.2);
  color: var(--stream-success);
}

.status-pill.cancelled {
  background: rgba(248, 113, 113, 0.2);
  color: var(--stream-danger);
}

.vault-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.metric-label {
  @include stat-label;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--stream-muted);
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--stream-text);
}

.vault-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--stream-muted);
}

.vault-actions {
  display: flex;
  gap: 10px;
}
</style>
