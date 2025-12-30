<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Neo Lottery</text>
      <text class="subtitle">Provably fair draws</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="countdown">{{ countdown }}</text>
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">#{{ round }}</text>
          <text class="stat-label">Round</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(prizePool) }}</text>
          <text class="stat-label">Prize Pool</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ totalTickets }}</text>
          <text class="stat-label">Total</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ userTickets }}</text>
          <text class="stat-label">Yours</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Buy Tickets</text>
      <view class="ticket-row">
        <view class="ticket-btn" @click="adjustTickets(-1)">
          <text>-</text>
        </view>
        <uni-easyinput v-model="tickets" type="number" class="ticket-input" />
        <view class="ticket-btn" @click="adjustTickets(1)">
          <text>+</text>
        </view>
      </view>
      <view class="total-row">
        <text class="total-label">Total Cost</text>
        <text class="total-value">{{ formatNum(totalCost, 1) }} GAS</text>
      </view>
      <view class="buy-btn" @click="buyTickets" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Processing..." : "Buy Tickets" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Recent Winners</text>
      <view class="winners-list">
        <text v-if="winners.length === 0" class="empty">No winners yet</text>
        <view v-for="(w, i) in winners" :key="i" class="winner-item">
          <text class="winner-round">#{{ w.round }}</text>
          <text class="winner-addr">{{ w.address.slice(0, 8) }}...</text>
          <text class="winner-prize">{{ formatNum(w.prize) }} GAS</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";
import { formatNumber, hexToBytes, randomIntFromBytes } from "@/shared/utils/format";

const APP_ID = "miniapp-lottery";
const TICKET_PRICE = 0.1;
const ROUND_DURATION = 60000;

interface Winner {
  round: number;
  address: string;
  prize: number;
}

const { payGAS, isLoading } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const tickets = ref(1);
const countdown = ref("01:00");
const round = ref(1);
const prizePool = ref(0);
const totalTickets = ref(0);
const userTickets = ref(0);
const winners = ref<Winner[]>([]);
const status = ref<{ msg: string; type: string } | null>(null);
const roundStart = ref(Date.now());

const totalCost = computed(() => tickets.value * TICKET_PRICE);

const formatNum = (n: number, d = 2) => formatNumber(n, d);

const adjustTickets = (delta: number) => {
  tickets.value = Math.max(1, Math.min(100, tickets.value + delta));
};

const buyTickets = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Purchasing...", type: "loading" };
    await payGAS(String(totalCost.value), `lottery:${round.value}:${tickets.value}`);
    status.value = { msg: `Bought ${tickets.value} ticket(s)!`, type: "success" };
    totalTickets.value += tickets.value;
    userTickets.value += tickets.value;
    prizePool.value += totalCost.value;
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

let timer: number;
onMounted(() => {
  timer = setInterval(() => {
    const elapsed = Date.now() - roundStart.value;
    const remaining = Math.max(0, ROUND_DURATION - (elapsed % ROUND_DURATION));
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    countdown.value = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  color: $color-gaming;
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
  color: $color-gaming;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.countdown {
  font-size: 2em;
  font-weight: bold;
  color: $color-gaming;
  text-align: center;
  display: block;
}

.stats-grid {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.stat-box {
  flex: 1;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-gaming;
  font-size: 1.2em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}

.ticket-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.ticket-btn {
  width: 40px;
  height: 40px;
  background: rgba($color-gaming, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-gaming;
  font-size: 1.5em;
}
.ticket-input {
  flex: 1;
}

.total-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
.total-label {
  color: $color-text-secondary;
}
.total-value {
  color: $color-gaming;
  font-weight: bold;
}

.buy-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.winners-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty {
  color: $color-text-secondary;
  text-align: center;
}
.winner-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
}
.winner-round {
  color: $color-gaming;
  font-weight: bold;
}
.winner-addr {
  color: $color-text-primary;
}
.winner-prize {
  color: $color-gaming;
}
</style>
