<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Price Ticker</text>
      <text class="subtitle">Real-time crypto prices</text>
    </view>

    <view class="card">
      <view class="refresh-row">
        <text class="card-title">Live Prices</text>
        <view class="refresh-btn" @click="refreshPrices">
          <text>🔄</text>
        </view>
      </view>
      <view v-for="price in prices" :key="price.symbol" class="price-row">
        <text class="symbol">{{ price.symbol }}</text>
        <view class="price-info">
          <text class="price">${{ formatNum(price.value) }}</text>
          <text :class="['change', price.change >= 0 ? 'up' : 'down']">
            {{ price.change >= 0 ? "▲" : "▼" }} {{ Math.abs(price.change).toFixed(2) }}%
          </text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Price Alert</text>
      <uni-easyinput v-model="alertSymbol" placeholder="Symbol (e.g., GAS)" class="input" />
      <uni-easyinput v-model="alertPrice" type="number" placeholder="Target price" class="input" />
      <view class="action-btn" @click="setAlert">
        <text>Set Alert</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-price-ticker";

interface Price {
  symbol: string;
  value: number;
  change: number;
}

const prices = ref<Price[]>([
  { symbol: "GAS", value: 4.82, change: 2.34 },
  { symbol: "NEO", value: 12.45, change: -1.23 },
  { symbol: "BTC", value: 43250.0, change: 0.87 },
  { symbol: "ETH", value: 2280.5, change: 1.45 },
]);

const alertSymbol = ref("");
const alertPrice = ref("");

const formatNum = (n: number) => formatNumber(n, 2);

const refreshPrices = () => {
  prices.value = prices.value.map((p) => ({
    ...p,
    value: p.value * (1 + (Math.random() - 0.5) * 0.02),
    change: (Math.random() - 0.5) * 6,
  }));
};

const setAlert = () => {
  if (!alertSymbol.value || !alertPrice.value) return;
  console.log(`Alert set: ${alertSymbol.value} @ $${alertPrice.value}`);
  alertSymbol.value = "";
  alertPrice.value = "";
};

let timer: number;
onMounted(() => {
  timer = setInterval(refreshPrices, 5000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: $color-text-primary;
  padding: 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-utility;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}
.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}
.refresh-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.card-title {
  color: $color-utility;
  font-size: 1.1em;
  font-weight: bold;
}
.refresh-btn {
  width: 36px;
  height: 36px;
  background: rgba($color-utility, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
}
.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba($color-utility, 0.1);
  border-radius: 8px;
  margin-bottom: 8px;
}
.symbol {
  font-weight: bold;
  font-size: 1.1em;
}
.price-info {
  text-align: right;
}
.price {
  font-size: 1.2em;
  font-weight: bold;
  color: $color-utility;
  display: block;
}
.change {
  font-size: 0.85em;
  margin-top: 4px;
  &.up {
    color: $color-success;
  }
  &.down {
    color: $color-error;
  }
}
.input {
  margin-bottom: 12px;
}
.action-btn {
  background: linear-gradient(135deg, $color-utility 0%, darken($color-utility, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
