<template>
  <div class="vault-card">
    <div class="vault-card__header">
      <div>
        <span class="vault-title">{{ stream.title || `#${stream.id}` }}</span>
        <span class="vault-subtitle">{{ (isCreator ? stream.beneficiary : stream.creator) ? formatAddress(isCreator ? stream.beneficiary : stream.creator) : t("notAvailable") }}</span>
      </div>
      <span :class="['status-pill', stream.status]">{{ statusLabel(stream.status) }}</span>
    </div>

    <!-- Progress bar: vested vs remaining -->
    <div class="vault-progress">
      <div class="progress-header">
        <span class="progress-label">{{ t("released") }}</span>
        <span class="progress-pct">{{ vestingPercent }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${vestingPercent}%` }" />
      </div>
      <div class="progress-legend">
        <span class="legend-vested">{{ formatAmount(stream.assetSymbol, stream.releasedAmount) }} vested</span>
        <span class="legend-remaining">{{ formatAmount(stream.assetSymbol, stream.remainingAmount) }} remaining</span>
      </div>
    </div>

    <div class="vault-metrics">
      <div v-for="metric in metrics" :key="metric.label">
        <span class="metric-label">{{ metric.label }}</span>
        <span class="metric-value">
          {{ formatAmount(stream.assetSymbol, metric.value) }} {{ stream.assetSymbol }}
        </span>
      </div>
    </div>

    <div class="vault-meta">
      <span class="meta-item">
        <span class="meta-icon" aria-hidden="true">&#x23F1;</span>
        {{ t("intervalLabel") }}: {{ stream.intervalDays }}d
      </span>
      <span class="meta-item">
        <span class="meta-icon" aria-hidden="true">&#x1F4B8;</span>
        {{ t("rateLabel") }}: {{ formatAmount(stream.assetSymbol, stream.rateAmount) }}
        {{ stream.assetSymbol }}
      </span>
    </div>

    <div class="vault-actions">
      <slot name="actions" :stream="stream" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatGas, formatAddress } from "@shared/utils/format";
import type { StreamItem, StreamStatus } from "@/types";

const props = withDefaults(
  defineProps<{
    stream: StreamItem;
    isCreator?: boolean;
  }>(),
  {
    stream: () => ({
      id: "",
      creator: "",
      beneficiary: "",
      asset: "",
      assetSymbol: "GAS" as const,
      totalAmount: 0n,
      releasedAmount: 0n,
      remainingAmount: 0n,
      rateAmount: 0n,
      intervalSeconds: 0n,
      intervalDays: 0,
      status: "active" as const,
      claimable: 0n,
      title: "",
      notes: "",
    }),
  }
);

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

const vestingPercent = computed(() => {
  const total = props.stream.totalAmount;
  if (total === 0n) return 0;
  return Math.min(100, Number((props.stream.releasedAmount * 100n) / total));
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

/* Progress bar */
.vault-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--stream-muted);
}

.progress-pct {
  font-size: 12px;
  font-weight: 800;
  color: var(--stream-accent, #3B82F6);
  font-family: 'DM Sans', sans-serif;
}

.progress-track {
  height: 6px;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #06B6D4);
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3));
    border-radius: 0 3px 3px 0;
  }
}

.progress-legend {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--stream-muted);
}

.legend-vested {
  color: #06B6D4;
  font-weight: 600;
}

.legend-remaining {
  color: var(--stream-muted);
  font-weight: 500;
}

.vault-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--stream-muted);
}

.meta-icon {
  margin-right: 3px;
  font-size: 12px;
}

.vault-actions {
  display: flex;
  gap: 10px;
}

/* Active stream pulse */
.vault-card:has(.status-pill:not(.completed):not(.cancelled)) {
  .progress-fill {
    animation: flow-shine 3s ease-in-out infinite;
  }
}

@keyframes flow-shine {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.3); }
}
</style>
