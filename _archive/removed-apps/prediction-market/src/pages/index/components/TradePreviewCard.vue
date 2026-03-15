<template>
  <div class="preview-card">
    <span class="preview-title">{{ t("txPreview") }}</span>
    <div class="preview-row">
      <span>{{ t("txMethod") }}</span>
      <span>{{ txMethod }}</span>
    </div>
    <div class="preview-row">
      <span>{{ t("txNetwork") }}</span>
      <span>Neo N3</span>
    </div>
    <div class="preview-row">
      <span>{{ t("txSubtotal") }}</span>
      <span>{{ formatGas(subtotal) }} GAS</span>
    </div>
    <div class="preview-row">
      <span>{{ t("txFee") }}</span>
      <span>{{ formatGas(fee) }} GAS</span>
    </div>
    <div class="preview-row delta" :class="{ positive: priceDelta > 0, negative: priceDelta < 0 }">
      <span>{{ t("txEdge") }}</span>
      <span>{{ formatSignedPercent(priceDelta) }}</span>
    </div>
    <div class="preview-row total">
      <span>{{ t("txTotal") }}</span>
      <span>{{ formatGas(subtotal + fee) }} GAS</span>
    </div>
    <div class="preview-row">
      <span>{{ t("txMaxPayout") }}</span>
      <span>{{ formatGas(maxPayout) }} GAS</span>
    </div>
    <div class="call-data-box">
      <span class="call-data-label">{{ t("txCallData") }}</span>
      <span class="call-data-value">{{ callData }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  txMethod: string;
  subtotal: number;
  fee: number;
  priceDelta: number;
  maxPayout: number;
  callData: string;
}>();

const { t } = createUseI18n(messages)();

const formatGas = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(3);
};

const formatSignedPercent = (value: number) => {
  const normalized = Number(value.toFixed(4));
  if (normalized === 0) return "0.0%";
  const sign = normalized > 0 ? "+" : "-";
  return `${sign}${Math.abs(normalized * 100).toFixed(1)}%`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.preview-card {
  border: 1px solid var(--predict-card-border);
  border-radius: 14px;
  background: var(--predict-bg-secondary);
  padding: 14px;
}

.preview-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--predict-text-muted);
  margin-bottom: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--predict-text-secondary);
  padding: 6px 0;

  &.delta.positive {
    color: var(--predict-success);
  }

  &.delta.negative {
    color: var(--predict-danger);
  }

  text:last-child {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    letter-spacing: 0.2px;
  }

  &.total {
    border-top: 1px solid var(--predict-card-border);
    margin-top: 4px;
    padding-top: 9px;
    font-weight: 700;
    color: var(--predict-text-primary);
  }
}

.call-data-box {
  margin-top: 10px;
  border-top: 1px dashed var(--predict-card-border);
  padding-top: 10px;
  background: rgba(148, 163, 184, 0.06);
  border-radius: 10px;
  padding: 10px;
  overflow: hidden;
}

.call-data-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.35px;
  color: var(--predict-text-muted);
  margin-bottom: 6px;
}

.call-data-value {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  color: var(--predict-text-primary);
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
