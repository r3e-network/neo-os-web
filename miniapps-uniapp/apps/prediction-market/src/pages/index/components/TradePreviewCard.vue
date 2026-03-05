<template>
  <view class="preview-card">
    <text class="preview-title">{{ t("txPreview") }}</text>
    <view class="preview-row">
      <text>{{ t("txMethod") }}</text>
      <text>{{ txMethod }}</text>
    </view>
    <view class="preview-row">
      <text>{{ t("txNetwork") }}</text>
      <text>Neo N3</text>
    </view>
    <view class="preview-row">
      <text>{{ t("txSubtotal") }}</text>
      <text>{{ formatGas(subtotal) }} GAS</text>
    </view>
    <view class="preview-row">
      <text>{{ t("txFee") }}</text>
      <text>{{ formatGas(fee) }} GAS</text>
    </view>
    <view class="preview-row delta" :class="{ positive: priceDelta > 0, negative: priceDelta < 0 }">
      <text>{{ t("txEdge") }}</text>
      <text>{{ formatSignedPercent(priceDelta) }}</text>
    </view>
    <view class="preview-row total">
      <text>{{ t("txTotal") }}</text>
      <text>{{ formatGas(subtotal + fee) }} GAS</text>
    </view>
    <view class="preview-row">
      <text>{{ t("txMaxPayout") }}</text>
      <text>{{ formatGas(maxPayout) }} GAS</text>
    </view>
    <view class="call-data-box">
      <text class="call-data-label">{{ t("txCallData") }}</text>
      <text class="call-data-value">{{ callData }}</text>
    </view>
  </view>
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
