<template>
  <view class="content-card">
    <view class="section-row">
      <text class="section-title">{{ t("yourOrders") }}</text>
      <text class="section-count">{{ marketOrders.length }}</text>
    </view>

    <view v-if="marketOrders.length === 0" class="empty-state">
      <text>{{ t("noOrders") }}</text>
    </view>
    <view v-else class="order-list">
      <view v-for="order in marketOrders" :key="order.id" class="order-item">
        <view class="order-main">
          <text class="order-type" :class="order.orderType">
            {{ order.orderType.toUpperCase() }} · {{ order.outcome.toUpperCase() }}
          </text>
          <text class="order-detail">{{ order.shares.toFixed(2) }} @ {{ formatPercent(order.price) }}</text>
        </view>

        <view
          v-if="order.status !== 'cancelled'"
          class="cancel-pill"
          role="button"
          tabindex="0"
          @click="emit('cancel-order', order.id)"
          @keydown.enter="emit('cancel-order', order.id)"
          @keydown.space.prevent="emit('cancel-order', order.id)"
        >
          <text>{{ t("cancelOrder") }}</text>
        </view>
      </view>
    </view>

    <view class="positions-section">
      <view class="section-row">
        <text class="section-title">{{ t("yourPositions") }}</text>
        <text class="section-count">{{ marketPositions.length }}</text>
      </view>

      <view v-if="marketPositions.length === 0" class="empty-state compact">
        <text>{{ t("noPositions") }}</text>
      </view>
      <view v-else class="position-list">
        <view
          v-for="position in marketPositions"
          :key="`${position.marketId}-${position.outcome}`"
          class="position-item"
        >
          <text class="position-outcome">{{ position.outcome.toUpperCase() }}</text>
          <text class="position-meta">{{ position.shares.toFixed(2) }} {{ t("shares") }}</text>
          <text class="position-meta">Avg {{ formatPercent(position.avgPrice) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import type { MarketOrder as TradingOrder, MarketPosition } from "@/composables/usePredictionTrading";

type ViewOrder = TradingOrder & { status?: string };

interface Props {
  marketOrders: ViewOrder[];
  marketPositions: MarketPosition[];
  t?: (key: string, args?: Record<string, string | number>) => string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "cancel-order", orderId: number): void;
}>();

const { t: i18nT } = useI18n();
const t = (key: string, args?: Record<string, string | number>) => {
  if (props.t) return props.t(key, args);
  return i18nT(key as never, args);
};

const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.content-card {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--predict-card-shadow);
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--predict-text-primary);
  display: block;
}

.section-count {
  font-size: 12px;
  color: var(--predict-text-muted);
  background: rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  padding: 4px 9px;
}

.empty-state {
  border: 1px dashed var(--predict-card-border);
  border-radius: 10px;
  background: var(--predict-bg-secondary);
  color: var(--predict-text-muted);
  text-align: center;
  padding: 14px;
  font-size: 13px;

  &.compact {
    padding: 10px;
  }
}

.order-list,
.position-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item,
.position-item {
  border: 1px solid var(--predict-card-border);
  background: var(--predict-bg-secondary);
  border-radius: 10px;
  padding: 11px 12px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.order-main {
  min-width: 0;
}

.order-type {
  display: block;
  font-size: 12px;
  font-weight: 700;

  &.buy {
    color: var(--predict-bid-text);
  }

  &.sell {
    color: var(--predict-ask-text);
  }
}

.order-detail {
  display: block;
  color: var(--predict-text-secondary);
  font-size: 12px;
  margin-top: 3px;
}

.cancel-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--predict-danger-bg);
  color: var(--predict-danger);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.cancel-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px -14px rgba(220, 38, 38, 0.9);
}

.cancel-pill:active {
  transform: translateY(0);
}

.cancel-pill:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
}

.positions-section {
  margin-top: 14px;
}

.position-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.position-outcome {
  font-size: 12px;
  font-weight: 700;
  color: var(--predict-accent);
}

.position-meta {
  font-size: 12px;
  color: var(--predict-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .cancel-pill {
    transition: none;
  }

  .cancel-pill:hover,
  .cancel-pill:active {
    transform: none;
  }
}
</style>
