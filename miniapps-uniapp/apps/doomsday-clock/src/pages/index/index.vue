<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Doomsday Clock</text>
      <text class="subtitle">Time-locked governance events</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card clock-card">
      <text class="clock-label">Time Until Event</text>
      <text class="clock-time">{{ countdown }}</text>
      <view class="clock-progress">
        <view class="progress-bar" :style="{ width: progress + '%' }"></view>
      </view>
    </view>

    <view class="card">
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(totalStaked) }}</text>
          <text class="stat-label">Total Staked</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(userStake) }}</text>
          <text class="stat-label">Your Stake</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ participants }}</text>
          <text class="stat-label">Players</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Stake on Outcome</text>
      <uni-easyinput v-model="stakeAmount" type="number" placeholder="Amount to stake" />
      <view class="outcomes-list">
        <view
          v-for="(outcome, i) in outcomes"
          :key="i"
          :class="['outcome-btn', selectedOutcome === i && 'active']"
          @click="selectedOutcome = i"
        >
          <text class="outcome-name">{{ outcome.name }}</text>
          <text class="outcome-odds">{{ outcome.odds }}x</text>
        </view>
      </view>
      <view class="stake-btn" @click="placeStake" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Staking..." : "Place Stake" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Event History</text>
      <view class="history-list">
        <view v-for="(event, i) in history" :key="i" class="history-item">
          <text class="history-date">{{ event.date }}</text>
          <text class="history-desc">{{ event.description }}</text>
          <text class="history-result">{{ event.result }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-doomsday-clock";

interface Outcome {
  name: string;
  odds: number;
}

interface HistoryEvent {
  date: string;
  description: string;
  result: string;
}

const { payGAS, isLoading } = usePayments(APP_ID);

const stakeAmount = ref("5");
const totalStaked = ref(25000);
const userStake = ref(50);
const participants = ref(142);
const countdown = ref("05:23:45");
const progress = ref(65);
const selectedOutcome = ref<number | null>(null);
const status = ref<{ msg: string; type: string } | null>(null);

const outcomes = ref<Outcome[]>([
  { name: "Protocol Upgrade", odds: 2.5 },
  { name: "Treasury Release", odds: 3.0 },
  { name: "Governance Vote", odds: 1.8 },
]);

const history = ref<HistoryEvent[]>([
  { date: "2025-12-20", description: "Emergency Proposal", result: "Passed" },
  { date: "2025-12-15", description: "Fee Adjustment", result: "Failed" },
]);

const formatNum = (n: number) => formatNumber(n, 0);

const placeStake = async () => {
  if (isLoading.value || selectedOutcome.value === null) {
    status.value = { msg: "Select an outcome", type: "error" };
    return;
  }
  const amount = parseFloat(stakeAmount.value);
  if (amount < 1) {
    status.value = { msg: "Min stake: 1 GAS", type: "error" };
    return;
  }
  try {
    status.value = { msg: "Placing stake...", type: "loading" };
    await payGAS(stakeAmount.value, `stake:${selectedOutcome.value}`);
    userStake.value += amount;
    totalStaked.value += amount;
    status.value = { msg: "Stake placed!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

let timer: number;
onMounted(() => {
  timer = setInterval(() => {
    const parts = countdown.value.split(":");
    let hours = parseInt(parts[0]);
    let mins = parseInt(parts[1]);
    let secs = parseInt(parts[2]);

    if (secs > 0) secs--;
    else if (mins > 0) {
      mins--;
      secs = 59;
    } else if (hours > 0) {
      hours--;
      mins = 59;
      secs = 59;
    }

    countdown.value = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, 1000);
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

.clock-card {
  text-align: center;
}
.clock-label {
  color: $color-text-secondary;
  font-size: 0.9em;
  display: block;
  margin-bottom: 8px;
}
.clock-time {
  font-size: 2.5em;
  font-weight: bold;
  color: $color-governance;
  display: block;
  margin-bottom: 16px;
}
.clock-progress {
  height: 8px;
  background: rgba($color-governance, 0.2);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: $color-governance;
  transition: width 0.3s;
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

.outcomes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}
.outcome-btn {
  padding: 12px;
  background: rgba($color-governance, 0.1);
  border: 2px solid transparent;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  &.active {
    border-color: $color-governance;
    background: rgba($color-governance, 0.2);
  }
}
.outcome-name {
  color: $color-text-primary;
}
.outcome-odds {
  color: $color-governance;
  font-weight: bold;
}

.stake-btn {
  background: linear-gradient(135deg, $color-governance 0%, darken($color-governance, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  padding: 12px;
  background: rgba($color-governance, 0.05);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.history-date {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.history-desc {
  color: $color-text-primary;
  flex: 1;
  margin: 0 12px;
}
.history-result {
  color: $color-governance;
  font-weight: bold;
  font-size: 0.9em;
}
</style>
