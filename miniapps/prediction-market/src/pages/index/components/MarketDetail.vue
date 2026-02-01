<template>
  <view class="market-detail">
    <!-- Back Button -->
    <view class="back-button" @click="$emit('back')">
      <text class="back-icon">←</text>
      <text>{{ t("markets") }}</text>
    </view>

    <!-- Market Header -->
    <view class="detail-header">
      <view class="detail-category">{{ getCategoryLabel(market.category) }}</view>
      <view class="detail-question">{{ market.question }}</view>
      <view class="detail-description">{{ market.description }}</view>

      <view class="detail-meta">
        <view class="meta-item">
          <text class="meta-label">{{ t("endTime") }}:</text>
          <text class="meta-value">{{ formatEndTime(market.endTime) }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">{{ t("resolutionSource") }}:</text>
          <text class="meta-value">{{ shortenAddress(market.oracle) }}</text>
        </view>
      </view>
    </view>

    <!-- Price Display -->
    <view class="price-display">
      <view class="price-box yes-box">
        <text class="price-outcome">{{ t("yesShares") }}</text>
        <text class="price-amount">{{ formatPrice(market.yesPrice) }}</text>
      </view>
      <view class="price-box no-box">
        <text class="price-outcome">{{ t("noShares") }}</text>
        <text class="price-amount">{{ formatPrice(market.noPrice) }}</text>
      </view>
    </view>

    <!-- Trading Form -->
    <view v-if="market.status === 'open'" class="trading-form">
      <view class="trade-type-selector">
        <view
          class="trade-type-option"
          :class="{ active: tradeForm.orderType === 'buy' }"
          @click="tradeForm.orderType = 'buy'"
        >
          <text>{{ t("buy") }}</text>
        </view>
        <view
          class="trade-type-option"
          :class="{ active: tradeForm.orderType === 'sell' }"
          @click="tradeForm.orderType = 'sell'"
        >
          <text>{{ t("sell") }}</text>
        </view>
      </view>

      <view class="outcome-selector">
        <view
          class="outcome-option"
          :class="{ active: tradeForm.outcome === 'yes' }"
          @click="tradeForm.outcome = 'yes'"
        >
          <text>{{ t("yesShares") }}</text>
        </view>
        <view class="outcome-option" :class="{ active: tradeForm.outcome === 'no' }" @click="tradeForm.outcome = 'no'">
          <text>{{ t("noShares") }}</text>
        </view>
      </view>

      <view class="trade-inputs">
        <view class="input-row">
          <text class="input-label">{{ t("amount") }} ({{ t("shares") }})</text>
          <input v-model.number="tradeForm.shares" type="number" class="trade-input" :placeholder="'1'" />
        </view>

        <view class="input-row">
          <text class="input-label">{{ t("orderPrice") }} (%)</text>
          <input
            v-model.number="tradeForm.price"
            type="number"
            class="trade-input"
            :placeholder="'50'"
            :max="100"
            :min="0"
            step="0.1"
          />
        </view>

        <view class="trade-summary">
          <text class="summary-label">{{ t("totalPrice") }}:</text>
          <text class="summary-value">{{ calculateTotal() }} GAS</text>
        </view>
      </view>

      <view class="trade-actions">
        <button class="trade-button" :disabled="isTrading || !isValidTrade()" @click="submitTrade">
          <text>{{ isTrading ? t("loading") : t("confirmTrade") }}</text>
        </button>
      </view>
    </view>

    <!-- Your Orders -->
    <view class="your-orders-section">
      <view class="section-title">{{ t("yourOrders") }}</view>
      <view v-if="marketOrders.length === 0" class="empty-orders">
        <text>{{ t("noOrders") }}</text>
      </view>
      <view v-else class="orders-list">
        <view v-for="order in marketOrders" :key="order.id" class="order-item">
          <view class="order-info">
            <view class="order-type" :class="order.orderType">
              {{ order.orderType.toUpperCase() }} {{ order.outcome.toUpperCase() }}
            </view>
            <view class="order-details">
              <text>{{ order.shares.toFixed(2) }} @ {{ (order.price * 100).toFixed(1) }}%</text>
            </view>
          </view>
          <view class="order-cancel" v-if="order.status === 'open'" @click="$emit('cancelOrder', order.id)">
            <text>{{ t("cancelOrder") }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";

interface PredictionMarket {
  id: number;
  question: string;
  description: string;
  category: string;
  endTime: number;
  oracle: string;
  status: string;
  yesPrice: number;
  noPrice: number;
}

interface MarketOrder {
  id: number;
  marketId: number;
  orderType: "buy" | "sell";
  outcome: "yes" | "no";
  price: number;
  shares: number;
  status: string;
}

interface Props {
  market: PredictionMarket;
  yourOrders: MarketOrder[];
  isTrading: boolean;
  t: (key: string) => string;
}

const props = defineProps<Props>();

defineEmits<{
  back: [];
  trade: [data: { outcome: "yes" | "no"; orderType: "buy" | "sell"; price: number; shares: number }];
  cancelOrder: [orderId: number];
}>();

const tradeForm = reactive({
  orderType: "buy" as "buy" | "sell",
  outcome: "yes" as "yes" | "no",
  shares: 1,
  price: 50,
});

const marketOrders = computed(() => {
  return props.yourOrders.filter((o) => o.marketId === props.market.id);
});

const formatPrice = (price: number): string => {
  return (price * 100).toFixed(1) + "%";
};

const formatEndTime = (endTime: number): string => {
  const date = new Date(endTime);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const shortenAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return address.slice(0, 6) + "..." + address.slice(-4);
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

const calculateTotal = (): string => {
  return ((tradeForm.price / 100) * tradeForm.shares).toFixed(4);
};

const isValidTrade = (): boolean => {
  return tradeForm.shares > 0 && tradeForm.shares <= 10000 && tradeForm.price >= 0 && tradeForm.price <= 100;
};

const submitTrade = () => {
  if (!isValidTrade()) return;

  props.$emit("trade", {
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

.market-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  cursor: pointer;
  color: var(--predict-accent);
  font-weight: 500;

  .back-icon {
    font-size: 18px;
  }
}

.detail-header {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 16px;
}

.detail-category {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.15);
  color: var(--predict-accent);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.detail-question {
  font-size: 18px;
  font-weight: 700;
  color: var(--predict-text-primary);
  line-height: 1.4;
  margin-bottom: 12px;
}

.detail-description {
  font-size: 14px;
  color: var(--predict-text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--predict-card-border);
}

.meta-item {
  display: flex;
  gap: 6px;
}

.meta-label {
  font-size: 12px;
  color: var(--predict-text-muted);
}

.meta-value {
  font-size: 12px;
  color: var(--predict-text-secondary);
  font-weight: 500;
}

.price-display {
  display: flex;
  gap: 12px;
}

.price-box {
  flex: 1;
  padding: 20px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  &.yes-box {
    background: var(--predict-bid-bg);
  }

  &.no-box {
    background: var(--predict-ask-bg);
  }
}

.price-outcome {
  font-size: 14px;
  font-weight: 600;
}

.yes-box .price-outcome {
  color: var(--predict-bid-text);
}

.no-box .price-outcome {
  color: var(--predict-ask-text);
}

.price-amount {
  font-size: 32px;
  font-weight: 700;
}

.yes-box .price-amount {
  color: var(--predict-bid-text);
}

.no-box .price-amount {
  color: var(--predict-ask-text);
}

.trading-form {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 16px;
}

.trade-type-selector,
.outcome-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.trade-type-option,
.outcome-option {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--predict-input-border);
  text-align: center;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.1);
    color: var(--predict-accent);
  }
}

.trade-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 12px;
  color: var(--predict-text-muted);
  font-weight: 500;
}

.trade-input {
  background: var(--predict-input-bg);
  border: 1px solid var(--predict-input-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--predict-text-primary);
  font-size: 14px;

  &:focus {
    border-color: var(--predict-input-focus);
    outline: none;
  }
}

.trade-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--predict-bg-secondary);
  border-radius: 8px;
  margin-top: 4px;
}

.summary-label {
  font-size: 13px;
  color: var(--predict-text-secondary);
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--predict-accent);
}

.trade-actions {
  margin-top: 16px;
}

.trade-button {
  width: 100%;
  padding: 14px;
  background: var(--predict-btn-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.your-orders-section {
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

.empty-orders {
  text-align: center;
  padding: 24px;
  color: var(--predict-text-muted);
  font-size: 14px;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--predict-bg-secondary);
  border-radius: 8px;
}

.order-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-type {
  font-size: 12px;
  font-weight: 700;

  &.buy {
    color: var(--predict-bid-text);
  }

  &.sell {
    color: var(--predict-ask-text);
  }
}

.order-details {
  font-size: 13px;
  color: var(--predict-text-secondary);
}

.order-cancel {
  padding: 6px 12px;
  background: var(--predict-danger-bg);
  color: var(--predict-danger);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
</style>
