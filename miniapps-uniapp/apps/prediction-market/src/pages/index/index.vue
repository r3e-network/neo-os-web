<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Prediction Market</text>
      <text class="subtitle">Bet on future outcomes</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(totalVolume) }}</text>
          <text class="stat-label">Volume</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(userBalance) }}</text>
          <text class="stat-label">Balance</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ activeMarkets }}</text>
          <text class="stat-label">Markets</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Active Markets</text>
      <view class="markets-list">
        <view v-for="(m, i) in markets" :key="i" class="market-item">
          <text class="market-question">{{ m.question }}</text>
          <view class="market-odds">
            <view class="odds-bar">
              <view class="odds-yes" :style="{ width: m.yesPercent + '%' }"></view>
            </view>
            <view class="odds-labels">
              <text class="odds-label">Yes {{ m.yesPercent }}%</text>
              <text class="odds-label">No {{ 100 - m.yesPercent }}%</text>
            </view>
          </view>
          <view class="bet-row">
            <uni-easyinput v-model="betAmounts[i]" type="number" placeholder="Amount" class="bet-input" />
            <view class="bet-btn yes" @click="placeBet(m.id, true, i)">
              <text>Yes</text>
            </view>
            <view class="bet-btn no" @click="placeBet(m.id, false, i)">
              <text>No</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-prediction-market";

interface Market {
  id: number;
  question: string;
  yesPercent: number;
}

const { payGAS, isLoading } = usePayments(APP_ID);

const totalVolume = ref(125000);
const userBalance = ref(50);
const activeMarkets = ref(4);
const status = ref<{ msg: string; type: string } | null>(null);
const betAmounts = ref<string[]>(["1", "1", "1", "1"]);

const markets = ref<Market[]>([
  { id: 1, question: "Will GAS reach $50 by end of Q1?", yesPercent: 65 },
  { id: 2, question: "Will Neo N4 launch in 2026?", yesPercent: 82 },
  { id: 3, question: "Will BTC hit $150k this year?", yesPercent: 45 },
]);

const formatNum = (n: number) => formatNumber(n, 0);

const placeBet = async (marketId: number, isYes: boolean, index: number) => {
  if (isLoading.value) return;
  const amount = parseFloat(betAmounts.value[index]);
  if (amount < 0.1) {
    status.value = { msg: "Min bet: 0.1 GAS", type: "error" };
    return;
  }
  try {
    status.value = { msg: "Placing bet...", type: "loading" };
    await payGAS(String(amount), `bet:${marketId}:${isYes ? "yes" : "no"}`);
    userBalance.value -= amount;
    status.value = { msg: `Bet placed on ${isYes ? "Yes" : "No"}!`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};
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
  color: $color-governance;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}

.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  color: $color-governance;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.stats-grid {
  display: flex;
  gap: 8px;
}
.stat-box {
  flex: 1;
  text-align: center;
  background: rgba($color-governance, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-governance;
  font-size: 1.2em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}

.markets-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.market-item {
  padding: 16px;
  background: rgba($color-governance, 0.05);
  border-radius: 12px;
}
.market-question {
  color: $color-text-primary;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.market-odds {
  margin-bottom: 12px;
}
.odds-bar {
  height: 8px;
  background: rgba($color-error, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}
.odds-yes {
  height: 100%;
  background: $color-success;
  transition: width 0.3s;
}
.odds-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
}
.odds-label {
  color: $color-text-secondary;
}

.bet-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.bet-input {
  flex: 1;
}
.bet-btn {
  padding: 10px 16px;
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
  &.yes {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.no {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}
</style>
