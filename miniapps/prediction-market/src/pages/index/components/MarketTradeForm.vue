<template>
  <view class="trade-panel">
    <text class="panel-title">{{ t("operationPanelTitle") }}</text>
    <text class="panel-subtitle">{{ t("operationPanelHint") }}</text>

    <view class="panel-badges">
      <view class="panel-badge">
        <text>{{ t("txNetwork") }}: Neo N3</text>
      </view>
      <view class="panel-badge">
        <text>{{ t("txContract") }}: {{ t("txContractValue") }}</text>
      </view>
    </view>

    <view class="workflow-strip">
      <view class="workflow-step active"
        ><text>{{ t("workflowStepConfig") }}</text></view
      >
      <view class="workflow-step"
        ><text>{{ t("workflowStepReview") }}</text></view
      >
      <view class="workflow-step"
        ><text>{{ t("workflowStepSign") }}</text></view
      >
    </view>

    <TradeSegmentControl
      :label="t('orderType')"
      :model-value="tradeForm.orderType"
      :options="orderTypeOptions"
      @update:model-value="tradeForm.orderType = $event as 'buy' | 'sell'"
    />

    <TradeSegmentControl
      :label="t('chooseOutcome')"
      :model-value="tradeForm.outcome"
      :options="outcomeOptions"
      @update:model-value="tradeForm.outcome = $event as 'yes' | 'no'"
    />

    <TradePresetChips
      :label="`${t('amount')} (${t('shares')})`"
      :model-value="tradeForm.shares"
      :presets="sharePresets"
      placeholder="10"
      :min="0"
      variant="shares"
      @update:model-value="tradeForm.shares = $event"
    />

    <TradePresetChips
      :label="`${t('orderPrice')} (%)`"
      :model-value="tradeForm.price"
      :presets="pricePresets"
      :max="100"
      :min="0"
      :step="0.1"
      @update:model-value="tradeForm.price = $event"
    />

    <TradePreviewCard
      :tx-method="txMethod"
      :subtotal="tradeTotal"
      :fee="estimatedFee"
      :price-delta="priceDelta"
      :max-payout="maxPayout"
      :call-data="callDataPreview"
      :t="t"
    />

    <button class="submit-button" :disabled="isTrading || !canSubmitTrade" @click="submitTrade">
      <text>{{ isTrading ? t("loading") : t("signAndSubmit") }}</text>
    </button>
    <text class="panel-footnote">{{ t("txFootnote") }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { PredictionMarket } from "@/composables/usePredictionMarkets";
import TradeSegmentControl from "./TradeSegmentControl.vue";
import TradePresetChips from "./TradePresetChips.vue";
import type { PresetItem } from "./TradePresetChips.vue";
import TradePreviewCard from "./TradePreviewCard.vue";

interface Props {
  market: PredictionMarket;
  isTrading: boolean;
  t?: (key: string, args?: Record<string, string | number>) => string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "trade", payload: { outcome: "yes" | "no"; orderType: "buy" | "sell"; price: number; shares: number }): void;
}>();

const { t: i18nT } = createUseI18n(messages)();
const t = (key: string, args?: Record<string, string | number>) => {
  if (props.t) return props.t(key, args);
  return i18nT(key as never, args);
};

const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;

const orderTypeOptions = computed(() => [
  { value: "buy", label: t("buy") },
  { value: "sell", label: t("sell") },
]);

const outcomeOptions = computed(() => [
  { value: "yes", label: `${t("yesShares")} ${formatPercent(props.market.yesPrice)}`, variant: "yes" },
  { value: "no", label: `${t("noShares")} ${formatPercent(props.market.noPrice)}`, variant: "no" },
]);

const sharePresets: PresetItem[] = [
  { value: 1, label: "+1" },
  { value: 10, label: "+10" },
  { value: 50, label: "+50" },
  { value: 100, label: "+100" },
];

const pricePresets: PresetItem[] = [
  { value: 10, label: "10%" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
];

const getDefaultPrice = (outcome: "yes" | "no") => {
  const sourcePrice = outcome === "yes" ? props.market.yesPrice : props.market.noPrice;
  return Number((sourcePrice * 100).toFixed(1));
};

const tradeForm = reactive<{
  orderType: "buy" | "sell";
  outcome: "yes" | "no";
  shares: number;
  price: number;
}>({
  orderType: "buy",
  outcome: "yes",
  shares: 10,
  price: getDefaultPrice("yes"),
});

watch(
  () => props.market.id,
  () => {
    tradeForm.orderType = "buy";
    tradeForm.outcome = "yes";
    tradeForm.shares = 10;
    tradeForm.price = getDefaultPrice("yes");
  }
);

watch(
  () => tradeForm.outcome,
  (outcome) => {
    tradeForm.price = getDefaultPrice(outcome);
  }
);

const tradeTotal = computed(() => (tradeForm.shares * tradeForm.price) / 100);
const estimatedFee = computed(() => tradeTotal.value * 0.003);
const maxPayout = computed(() => tradeForm.shares);
const outcomeMarketPrice = computed(() => (tradeForm.outcome === "yes" ? props.market.yesPrice : props.market.noPrice));
const priceDelta = computed(() => tradeForm.price / 100 - outcomeMarketPrice.value);

const canSubmitTrade = computed(() => {
  return (
    props.market.status === "open" &&
    Number.isFinite(tradeForm.shares) &&
    Number.isFinite(tradeForm.price) &&
    tradeForm.shares > 0 &&
    tradeForm.shares <= 100000 &&
    tradeForm.price > 0 &&
    tradeForm.price <= 100
  );
});

const txMethod = computed(() => {
  if (tradeForm.orderType === "sell") {
    return tradeForm.outcome === "yes" ? "SellYes" : "SellNo";
  }
  return tradeForm.outcome === "yes" ? "BuyYes" : "BuyNo";
});

const callDataPreview = computed(() => {
  const normalizedPrice = (tradeForm.price / 100).toFixed(3);
  return `${txMethod.value}(marketId=${props.market.id}, outcome=${tradeForm.outcome}, shares=${tradeForm.shares}, price=${normalizedPrice})`;
});

const submitTrade = () => {
  if (!canSubmitTrade.value) return;

  emit("trade", {
    outcome: tradeForm.outcome,
    orderType: tradeForm.orderType,
    price: tradeForm.price / 100,
    shares: tradeForm.shares,
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.trade-panel {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--predict-card-shadow);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    left: 20px;
    right: 20px;
    top: 0;
    height: 1px;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0));
  }
}

.panel-title {
  display: block;
  font-size: 22px;
  color: var(--predict-text-primary);
  font-weight: 800;
}

.panel-subtitle {
  display: block;
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--predict-text-secondary);
}

.panel-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.panel-badge {
  border: 1px solid var(--predict-card-border);
  background: rgba(148, 163, 184, 0.08);
  border-radius: 999px;
  padding: 5px 10px;
  color: var(--predict-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.workflow-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.workflow-step {
  border: 1px solid var(--predict-card-border);
  background: var(--predict-bg-secondary);
  border-radius: 999px;
  padding: 7px 8px;
  text-align: center;
  color: var(--predict-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;

  &.active {
    border-color: rgba(59, 130, 246, 0.45);
    color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.1);
  }
}

.submit-button {
  width: 100%;
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  padding: 12px;
  color: var(--predict-text-bright);
  background: linear-gradient(135deg, var(--predict-btn-primary), var(--predict-btn-primary-hover));
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px -18px rgba(37, 99, 235, 0.9);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.45);
    outline-offset: 2px;
  }
}

.panel-footnote {
  display: block;
  margin-top: 10px;
  font-size: 11px;
  color: var(--predict-text-muted);
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .submit-button {
    transition: none;
  }

  .submit-button:not(:disabled):hover,
  .submit-button:not(:disabled):active {
    transform: none;
  }
}
</style>
