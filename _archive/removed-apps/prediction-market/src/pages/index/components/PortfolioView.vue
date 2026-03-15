<template>
  <div class="portfolio-view">
    <!-- Portfolio Summary -->
    <div class="portfolio-summary">
      <div class="summary-card value-card">
        <span class="summary-label">{{ t("totalValue") }}</span>
        <span class="summary-value">{{ totalValue.toFixed(4) }} GAS</span>
      </div>
      <div class="summary-card pnl-card">
        <span class="summary-label">{{ t("totalPnL") }}</span>
        <span class="summary-value" :class="pnlClass">{{ formatPnL(totalPnL) }}</span>
      </div>
    </div>

    <!-- Positions Section -->
    <div class="positions-section">
      <div class="section-title">{{ t("yourPositions") }}</div>
      <div v-if="positions.length === 0" class="empty-state">
        <span>{{ t("noPositions") }}</span>
      </div>
      <div v-else class="positions-list">
        <div v-for="pos in displayPositions" :key="`${pos.marketId}-${pos.outcome}`" class="position-card">
          <div class="position-header">
            <span class="position-market">{{ getMarketQuestion(pos.marketId) }}</span>
            <div class="position-outcome" :class="pos.outcome">
              {{ pos.outcome.toUpperCase() }}
            </div>
          </div>

          <div class="position-stats">
            <div class="stat-row">
              <span class="stat-label">{{ t("positionShares") }}:</span>
              <span class="stat-value">{{ pos.shares.toFixed(4) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("positionAvgPrice") }}:</span>
              <span class="stat-value">{{ (pos.avgPrice * 100).toFixed(1) }}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">{{ t("positionValue") }}:</span>
              <span class="stat-value">{{ formatPositionValue(pos) }} GAS</span>
            </div>
          </div>

          <div class="position-actions">
            <div
              v-if="hasWinningPosition(pos)"
              class="claim-button"
              role="button"
              tabindex="0"
              :aria-label="t('claimWinnings')"
              @click="$emit('claim', pos.marketId)"
            >
              <span>{{ t("claimWinnings") }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Orders Section -->
    <div class="orders-section">
      <div class="section-title">{{ t("yourOrders") }}</div>
      <div v-if="openOrders.length === 0" class="empty-state">
        <span>{{ t("noOrders") }}</span>
      </div>
      <div v-else class="orders-list">
        <div v-for="order in openOrders" :key="order.id" class="order-card">
          <div class="order-header">
            <span class="order-market">{{ getMarketQuestion(order.marketId) }}</span>
            <div class="order-status" :class="order.status">
              {{ order.status.toUpperCase() }}
            </div>
          </div>

          <div class="order-details">
            <div class="order-type" :class="order.orderType">
              {{ order.orderType.toUpperCase() }} {{ order.outcome.toUpperCase() }}
            </div>
            <div class="order-info">
              <span>{{ order.shares.toFixed(2) }} @ {{ (order.price * 100).toFixed(1) }}%</span>
            </div>
          </div>

          <div
            v-if="order.status === 'open'"
            class="order-cancel"
            role="button"
            tabindex="0"
            :aria-label="t('cancelOrder')"
            @click="$emit('cancelOrder', order.id)"
          >
            <span>{{ t("cancelOrder") }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MarketPosition, MarketOrder } from "@/types";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

interface Props {
  positions: MarketPosition[];
  orders: MarketOrder[];
  totalValue: number;
  totalPnL: number;
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

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
