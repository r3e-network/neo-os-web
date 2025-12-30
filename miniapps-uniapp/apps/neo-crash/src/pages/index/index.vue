<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Neo Crash</text>
      <text class="subtitle">Multiplier crash game</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card multiplier-card">
      <text :class="['multiplier', gameState]">{{ currentMultiplier }}x</text>
      <text class="game-status">{{ gameStatusText }}</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressWidth + '%' }"></view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Place Bet</text>
      <view class="bet-row">
        <text class="label">Amount (GAS)</text>
        <view class="input-group">
          <view class="adjust-btn" @click="adjustBet(-0.1)">
            <text>-</text>
          </view>
          <uni-easyinput v-model="betAmount" type="digit" class="bet-input" />
          <view class="adjust-btn" @click="adjustBet(0.1)">
            <text>+</text>
          </view>
        </view>
      </view>
      <view class="bet-row">
        <text class="label">Auto Cashout</text>
        <uni-easyinput v-model="autoCashout" type="digit" placeholder="2.0" class="cashout-input" />
      </view>
      <view :class="['action-btn', gameState]" @click="handleAction" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ actionButtonText }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Recent Crashes</text>
      <view class="history-list">
        <view v-for="(h, i) in history" :key="i" :class="['history-item', h.multiplier >= 2 ? 'high' : 'low']">
          <text class="history-multiplier">{{ h.multiplier }}x</text>
        </view>
      </view>
    </view>

    <view class="card stats-card">
      <view class="stat-row">
        <text class="stat-label">Your Bet</text>
        <text class="stat-value">{{ formatNum(currentBet) }} GAS</text>
      </view>
      <view class="stat-row">
        <text class="stat-label">Potential Win</text>
        <text class="stat-value success">{{ formatNum(potentialWin) }} GAS</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-neo-crash";

const { payGAS, isLoading } = usePayments(APP_ID);

const betAmount = ref("1.0");
const autoCashout = ref("2.0");
const currentMultiplier = ref(1.0);
const gameState = ref<"waiting" | "running" | "crashed">("waiting");
const currentBet = ref(0);
const status = ref<{ msg: string; type: string } | null>(null);
const history = ref([
  { multiplier: 1.52 },
  { multiplier: 3.21 },
  { multiplier: 1.08 },
  { multiplier: 2.45 },
  { multiplier: 1.89 },
]);

const progressWidth = computed(() => {
  if (gameState.value === "waiting") return 0;
  if (gameState.value === "crashed") return 100;
  return Math.min(100, (currentMultiplier.value - 1) * 20);
});

const gameStatusText = computed(() => {
  if (gameState.value === "waiting") return "Waiting for next round...";
  if (gameState.value === "running") return "Game in progress!";
  return "CRASHED!";
});

const actionButtonText = computed(() => {
  if (isLoading.value) return "Processing...";
  if (gameState.value === "waiting") return "Place Bet";
  if (gameState.value === "running" && currentBet.value > 0) return "Cash Out";
  return "Wait...";
});

const potentialWin = computed(() => currentBet.value * currentMultiplier.value);

const formatNum = (n: number, d = 2) => formatNumber(n, d);

const adjustBet = (delta: number) => {
  const val = Math.max(0.1, parseFloat(betAmount.value) + delta);
  betAmount.value = val.toFixed(1);
};

const handleAction = async () => {
  if (isLoading.value) return;

  if (gameState.value === "waiting") {
    await placeBet();
  } else if (gameState.value === "running" && currentBet.value > 0) {
    cashOut();
  }
};

const placeBet = async () => {
  try {
    status.value = { msg: "Placing bet...", type: "loading" };
    await payGAS(betAmount.value, `crash:bet:${Date.now()}`);
    currentBet.value = parseFloat(betAmount.value);
    status.value = { msg: "Bet placed! Good luck!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error placing bet", type: "error" };
  }
};

const cashOut = () => {
  const winAmount = potentialWin.value;
  status.value = { msg: `Cashed out at ${currentMultiplier.value}x! Won ${formatNum(winAmount)} GAS`, type: "success" };
  currentBet.value = 0;
};

let gameTimer: number;
onMounted(() => {
  gameTimer = setInterval(() => {
    if (gameState.value === "waiting") {
      setTimeout(() => {
        gameState.value = "running";
        currentMultiplier.value = 1.0;
      }, 3000);
    } else if (gameState.value === "running") {
      currentMultiplier.value += 0.05;

      if (autoCashout.value && currentBet.value > 0 && currentMultiplier.value >= parseFloat(autoCashout.value)) {
        cashOut();
      }

      if (Math.random() < 0.02 || currentMultiplier.value > 10) {
        gameState.value = "crashed";
        history.value.unshift({ multiplier: parseFloat(currentMultiplier.value.toFixed(2)) });
        history.value = history.value.slice(0, 10);
        if (currentBet.value > 0) {
          status.value = { msg: "Crashed! Better luck next time.", type: "error" };
          currentBet.value = 0;
        }
        setTimeout(() => {
          gameState.value = "waiting";
          currentMultiplier.value = 1.0;
        }, 2000);
      }
    }
  }, 100);
});

onUnmounted(() => clearInterval(gameTimer));
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
  &.loading {
    background: rgba($color-gaming, 0.15);
    color: $color-gaming;
  }
}

.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.multiplier-card {
  text-align: center;
  padding: 32px 20px;
}

.multiplier {
  font-size: 3em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
  &.waiting {
    color: $color-text-secondary;
  }
  &.running {
    color: $color-gaming;
  }
  &.crashed {
    color: $color-error;
  }
}

.game-status {
  color: $color-text-secondary;
  font-size: 0.9em;
  display: block;
  margin-bottom: 16px;
}

.progress-bar {
  height: 6px;
  background: rgba($color-gaming, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-gaming 0%, $color-error 100%);
  transition: width 0.1s linear;
}

.card-title {
  color: $color-gaming;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}

.bet-row {
  margin-bottom: 16px;
}

.label {
  color: $color-text-secondary;
  font-size: 0.9em;
  display: block;
  margin-bottom: 8px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.adjust-btn {
  width: 36px;
  height: 36px;
  background: rgba($color-gaming, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-gaming;
  font-size: 1.3em;
}

.bet-input,
.cashout-input {
  flex: 1;
}

.action-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 8px;
  &.crashed {
    background: rgba($color-text-secondary, 0.3);
  }
}

.history-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.history-item {
  padding: 8px 12px;
  border-radius: 8px;
  &.high {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.low {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}

.history-multiplier {
  font-weight: bold;
}

.stats-card {
  .stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }
  }
  .stat-label {
    color: $color-text-secondary;
  }
  .stat-value {
    color: $color-gaming;
    font-weight: bold;
    &.success {
      color: $color-success;
    }
  }
}
</style>
