<template>
  <view class="hero-card">
    <view class="hero-topline">
      <text class="hero-category">{{ getCategoryLabel(market.category) }}</text>
      <text class="hero-status" :class="`status-${market.status}`">{{ statusLabel }}</text>
    </view>

    <text class="hero-question">{{ market.question }}</text>
    <text class="hero-description">{{ market.description || t("marketDescriptionFallback") }}</text>

    <view class="hero-meta">
      <view class="meta-chip">
        <text class="meta-label">{{ t("endTime") }}</text>
        <text class="meta-value">{{ formatEndTime(market.endTime) }}</text>
      </view>
      <view class="meta-chip">
        <text class="meta-label">{{ t("resolutionSource") }}</text>
        <text class="meta-value">{{ formatAddress(market.oracle) }}</text>
      </view>
      <view class="meta-chip">
        <text class="meta-label">{{ t("totalVolume") }}</text>
        <text class="meta-value">{{ formatGas(market.totalVolume) }} GAS</text>
      </view>
    </view>

    <view class="odds-grid">
      <view class="odds-card yes-card">
        <text class="odds-label">{{ t("yesShares") }}</text>
        <text class="odds-value">{{ formatPercent(market.yesPrice) }}</text>
      </view>
      <view class="odds-card no-card">
        <text class="odds-label">{{ t("noShares") }}</text>
        <text class="odds-value">{{ formatPercent(market.noPrice) }}</text>
      </view>
    </view>
  </view>

  <view class="content-card">
    <text class="section-title">{{ t("coreLogicTitle") }}</text>
    <view class="logic-list">
      <view class="logic-item">
        <text class="logic-label">{{ t("logicResolutionRule") }}</text>
        <text class="logic-value">{{ market.description || t("marketDescriptionFallback") }}</text>
      </view>
      <view class="logic-item">
        <text class="logic-label">{{ t("logicSettlementAt") }}</text>
        <text class="logic-value">{{ formatEndTime(market.endTime) }}</text>
      </view>
      <view class="logic-item">
        <text class="logic-label">{{ t("logicOracle") }}</text>
        <text class="logic-value">{{ formatAddress(market.oracle) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatAddress } from "@shared/utils/format";
import type { PredictionMarket } from "@/composables/usePredictionMarkets";

interface Props {
  market: PredictionMarket;
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

const categoryLabelMap = {
  crypto: "categoryCrypto",
  sports: "categorySports",
  politics: "categoryPolitics",
  economics: "categoryEconomics",
  entertainment: "categoryEntertainment",
  other: "categoryOther",
} as const;

const statusLabelMap = {
  open: "statusOpen",
  closed: "statusClosed",
  resolved: "statusResolved",
  cancelled: "statusCancelled",
} as const;

const statusLabel = computed(() => {
  const statusKey = statusLabelMap[props.market.status as keyof typeof statusLabelMap] ?? "statusOpen";
  return t(statusKey);
});

const getCategoryLabel = (category: string) => {
  const key = categoryLabelMap[category as keyof typeof categoryLabelMap] ?? "categoryOther";
  return t(key);
};

const formatEndTime = (endTime: number) => {
  const date = new Date(endTime);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;

const formatGas = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(3);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.hero-card,
.content-card {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--predict-card-shadow);
}

.hero-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.hero-category,
.hero-status {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.hero-category {
  background: rgba(59, 130, 246, 0.14);
  color: var(--predict-accent);
}

.hero-status {
  color: var(--predict-text-primary);
  background: rgba(156, 163, 175, 0.14);

  &.status-open {
    background: var(--predict-success-bg);
    color: var(--predict-success);
  }

  &.status-closed {
    background: var(--predict-warning-bg);
    color: var(--predict-warning);
  }

  &.status-resolved {
    background: rgba(59, 130, 246, 0.14);
    color: var(--predict-accent);
  }

  &.status-cancelled {
    background: var(--predict-danger-bg);
    color: var(--predict-danger);
  }
}

.hero-question {
  font-size: 26px;
  font-weight: 750;
  line-height: 1.32;
  color: var(--predict-text-primary);
  margin-bottom: 12px;
  display: block;

  @media (min-width: 1024px) {
    font-size: 32px;
  }
}

.hero-description {
  font-size: 15px;
  line-height: 1.62;
  color: var(--predict-text-secondary);
  display: block;
}

.hero-meta {
  display: grid;
  gap: 10px;
  margin-top: 16px;

  @media (min-width: 760px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.meta-chip {
  background: var(--predict-bg-secondary);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 10px 12px;
}

.meta-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--predict-text-muted);
  margin-bottom: 4px;
}

.meta-value {
  display: block;
  font-size: 13px;
  color: var(--predict-text-primary);
  font-weight: 600;
}

.odds-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.odds-card {
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.yes-card {
    background: var(--predict-bid-bg);
    color: var(--predict-bid-text);
  }

  &.no-card {
    background: var(--predict-ask-bg);
    color: var(--predict-ask-text);
  }
}

.odds-label {
  font-size: 12px;
  font-weight: 600;
}

.odds-value {
  font-size: 30px;
  font-weight: 800;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--predict-text-primary);
  display: block;
}

.logic-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logic-item {
  border: 1px solid var(--predict-card-border);
  border-radius: 10px;
  background: var(--predict-bg-secondary);
  padding: 12px;
}

.logic-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--predict-text-muted);
  margin-bottom: 6px;
}

.logic-value {
  display: block;
  font-size: 13px;
  line-height: 1.45;
  color: var(--predict-text-secondary);
}
</style>
