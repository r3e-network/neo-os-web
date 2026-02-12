<template>
  <view class="portfolio-view">
    <!-- Portfolio Summary -->
    <view class="portfolio-summary">
      <view class="summary-card value-card">
        <text class="summary-label">{{ t("totalValue") }}</text>
        <text class="summary-value">{{ totalValue.toFixed(4) }} GAS</text>
      </view>
      <view class="summary-card pnl-card">
        <text class="summary-label">{{ t("totalPnL") }}</text>
        <text class="summary-value" :class="pnlClass">{{ formatPnL(totalPnL) }}</text>
      </view>
    </view>

    <!-- Positions Section -->
    <view class="positions-section">
      <view class="section-title">{{ t("yourPositions") }}</view>
      <view v-if="positions.length === 0" class="empty-state">
        <text>{{ t("noPositions") }}</text>
      </view>
      <view v-else class="positions-list">
        <view v-for="pos in displayPositions" :key="`${pos.marketId}-${pos.outcome}`" class="position-card">
          <view class="position-header">
            <text class="position-market">{{ getMarketQuestion(pos.marketId) }}</text>
            <view class="position-outcome" :class="pos.outcome">
              {{ pos.outcome.toUpperCase() }}
            </view>
          </view>

          <view class="position-stats">
            <view class="stat-row">
              <text class="stat-label">{{ t("positionShares") }}:</text>
              <text class="stat-value">{{ pos.shares.toFixed(4) }}</text>
            </view>
            <view class="stat-row">
              <text class="stat-label">{{ t("positionAvgPrice") }}:</text>
              <text class="stat-value">{{ (pos.avgPrice * 100).toFixed(1) }}%</text>
            </view>
            <view class="stat-row">
              <text class="stat-label">{{ t("positionValue") }}:</text>
              <text class="stat-value">{{ formatPositionValue(pos) }} GAS</text>
            </view>
          </view>

          <view class="position-actions">
            <view v-if="hasWinningPosition(pos)" class="claim-button" role="button" tabindex="0" :aria-label="t('claimWinnings')" @click="$emit('claim', pos.marketId)">
              <text>{{ t("claimWinnings") }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Orders Section -->
    <view class="orders-section">
      <view class="section-title">{{ t("yourOrders") }}</view>
      <view v-if="openOrders.length === 0" class="empty-state">
        <text>{{ t("noOrders") }}</text>
      </view>
      <view v-else class="orders-list">
        <view v-for="order in openOrders" :key="order.id" class="order-card">
          <view class="order-header">
            <text class="order-market">{{ getMarketQuestion(order.marketId) }}</text>
            <view class="order-status" :class="order.status">
              {{ order.status.toUpperCase() }}
            </view>
          </view>

          <view class="order-details">
            <view class="order-type" :class="order.orderType">
              {{ order.orderType.toUpperCase() }} {{ order.outcome.toUpperCase() }}
            </view>
            <view class="order-info">
              <text>{{ order.shares.toFixed(2) }} @ {{ (order.price * 100).toFixed(1) }}%</text>
            </view>
          </view>

          <view v-if="order.status === 'open'" class="order-cancel" role="button" tabindex="0" :aria-label="t('cancelOrder')" @click="$emit('cancelOrder', order.id)">
            <text>{{ t("cancelOrder") }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MarketPosition, MarketOrder } from "@/types";

interface Props {
  positions: MarketPosition[];
  orders: MarketOrder[];
  totalValue: number;
  totalPnL: number;
  t: (key: string) => string;
}

const props = defineProps<Props>();

defineEmits<{
  claim: [marketId: number];
  cancelOrder: [orderId: number];
}>();

// Helper function to get market question (simplified - in real app would fetch from market data)
const getMarketQuestion = (marketId: number): string => {
  return `Market #${marketId}`;
};

const pnlClass = computed(() => {
  return {
    positive: props.totalPnL > 0,
    negative: props.totalPnL < 0,
    neutral: props.totalPnL === 0,
  };
});

const formatPnL = (pnl: number): string => {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(4)} GAS`;
};

const formatPositionValue = (pos: MarketPosition): string => {
  const value = pos.currentValue ?? pos.shares * pos.avgPrice;
  return value.toFixed(4);
};

const hasWinningPosition = (pos: MarketPosition): boolean => {
  // In a real implementation, this would check if the market is resolved
  // and if this position's outcome matches the resolution
  return false;
};

const displayPositions = computed(() => {
  return props.positions.filter((p) => p.shares > 0);
});

const openOrders = computed(() => {
  return props.orders.filter((o) => o.status === "open");
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.portfolio-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.portfolio-summary {
  display: flex;
  gap: 12px;
}

.summary-card {
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
}

.summary-label {
  font-size: 12px;
  color: var(--predict-text-muted);
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--predict-text-primary);
}

.pnl-card .summary-value {
  &.positive {
    color: var(--predict-up);
  }

  &.negative {
    color: var(--predict-down);
  }

  &.neutral {
    color: var(--predict-neutral);
  }
}

.positions-section,
.orders-section {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--predict-text-primary);
  margin-bottom: 12px;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--predict-text-muted);
  font-size: 14px;
}

.positions-list,
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-card,
.order-card {
  padding: 12px;
  background: var(--predict-bg-secondary);
  border-radius: 8px;
}

.position-header,
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.position-market,
.order-market {
  font-size: 14px;
  font-weight: 600;
  color: var(--predict-text-primary);
  flex: 1;
}

.position-outcome {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;

  &.yes {
    background: var(--predict-bid-bg);
    color: var(--predict-bid-text);
  }

  &.no {
    background: var(--predict-ask-bg);
    color: var(--predict-ask-text);
  }
}

.order-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;

  &.open {
    background: var(--predict-success-bg);
    color: var(--predict-success);
  }

  &.filled {
    background: var(--predict-card-bg);
    color: var(--predict-text-secondary);
  }

  &.cancelled {
    background: var(--predict-danger-bg);
    color: var(--predict-danger);
  }
}

.position-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 12px;
  color: var(--predict-text-muted);
}

.stat-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--predict-text-secondary);
}

.position-actions {
  display: flex;
  justify-content: flex-end;
}

.claim-button {
  padding: 8px 16px;
  background: var(--predict-success);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.order-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-type {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;

  &.buy {
    background: var(--predict-bid-bg);
    color: var(--predict-bid-text);
  }

  &.sell {
    background: var(--predict-ask-bg);
    color: var(--predict-ask-text);
  }
}

.order-info {
  font-size: 13px;
  color: var(--predict-text-secondary);
}

.order-cancel {
  padding: 8px 16px;
  background: var(--predict-danger-bg);
  color: var(--predict-danger);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
}
</style>
