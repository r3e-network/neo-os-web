<template>
  <view class="market-card" @click="$emit('click')">
    <view class="market-header">
      <view class="market-category">{{ getCategoryLabel(market.category) }}</view>
      <view class="market-status" :class="`status-${market.status}`">
        {{ getStatusLabel(market.status) }}
      </view>
    </view>

    <view class="market-question">{{ market.question }}</view>

    <view class="market-prices">
      <view class="price-row yes">
        <text class="price-label">{{ t("yesShares") }}</text>
        <text class="price-value">{{ formatPrice(market.yesPrice) }}</text>
      </view>
      <view class="price-row no">
        <text class="price-label">{{ t("noShares") }}</text>
        <text class="price-value">{{ formatPrice(market.noPrice) }}</text>
      </view>
    </view>

    <view class="market-footer">
      <view class="market-volume">
        <text class="volume-label">{{ t("totalVolume") }}:</text>
        <text class="volume-value">{{ formatVolume(market.totalVolume) }} GAS</text>
      </view>
      <view class="market-time">
        <text>{{ getTimeRemaining(market.endTime) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface PredictionMarket {
  id: number;
  question: string;
  category: string;
  endTime: number;
  status: string;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
}

interface Props {
  market: PredictionMarket;
  t: (key: string) => string;
}

defineProps<Props>();

defineEmits<{
  click: [];
}>();

const formatPrice = (price: number): string => {
  return (price * 100).toFixed(1) + "%";
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000) return (volume / 1000).toFixed(1) + "k";
  return volume.toFixed(2);
};

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    crypto: "Crypto",
    sports: "Sports",
    politics: "Politics",
    economics: "Economics",
    entertainment: "Entertainment",
    other: "Other",
  };
  return labels[category] || "Other";
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    open: "Open",
    closed: "Closed",
    resolved: "Resolved",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
};

const getTimeRemaining = (endTime: number): string => {
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.market-card {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--predict-card-shadow);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:active {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }
}

.market-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.market-category {
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.15);
  color: var(--predict-accent);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.market-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;

  &.status-open {
    background: var(--predict-success-bg);
    color: var(--predict-success);
  }

  &.status-closed {
    background: var(--predict-warning-bg);
    color: var(--predict-warning);
  }

  &.status-resolved {
    background: var(--predict-card-bg);
    color: var(--predict-text-secondary);
  }

  &.status-cancelled {
    background: var(--predict-danger-bg);
    color: var(--predict-danger);
  }
}

.market-question {
  font-size: 16px;
  font-weight: 600;
  color: var(--predict-text-primary);
  line-height: 1.4;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.market-prices {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.price-row {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &.yes {
    background: var(--predict-bid-bg);
  }

  &.no {
    background: var(--predict-ask-bg);
  }
}

.price-label {
  font-size: 12px;
  font-weight: 600;
}

.price-row.yes .price-label {
  color: var(--predict-bid-text);
}

.price-row.no .price-label {
  color: var(--predict-ask-text);
}

.price-value {
  font-size: 18px;
  font-weight: 700;
}

.price-row.yes .price-value {
  color: var(--predict-bid-text);
}

.price-row.no .price-value {
  color: var(--predict-ask-text);
}

.market-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--predict-card-border);
}

.market-volume {
  display: flex;
  gap: 4px;
  align-items: baseline;
}

.volume-label {
  font-size: 12px;
  color: var(--predict-text-muted);
}

.volume-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--predict-text-secondary);
}

.market-time {
  font-size: 12px;
  color: var(--predict-text-muted);
  font-weight: 500;
}
</style>
