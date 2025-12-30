<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Candle Wars</text>
      <text class="subtitle">Price prediction battles</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Current Price</text>
      <view class="price-display">
        <text class="price-value">${{ currentPrice }}</text>
        <text :class="['price-change', priceChange >= 0 ? 'up' : 'down']">
          {{ priceChange >= 0 ? "↑" : "↓" }} {{ Math.abs(priceChange) }}%
        </text>
      </view>
      <view class="candle-chart">
        <view
          v-for="(candle, i) in candles"
          :key="i"
          :class="['candle', candle.type]"
          :style="{ height: candle.height + '%' }"
        >
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Place Prediction</text>
      <uni-easyinput v-model="betAmount" type="number" placeholder="Bet amount (GAS)" />
      <view class="prediction-row">
        <view :class="['pred-btn', 'up', prediction === 'up' && 'active']" @click="prediction = 'up'">
          <text>📈 Price Up</text>
        </view>
        <view :class="['pred-btn', 'down', prediction === 'down' && 'active']" @click="prediction = 'down'">
          <text>📉 Price Down</text>
        </view>
      </view>
      <view class="submit-btn" @click="submitPrediction" :style="{ opacity: isPredicting ? 0.6 : 1 }">
        <text>{{ isPredicting ? "Submitting..." : "Submit Prediction" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Battle Stats</text>
      <view class="stats-grid">
        <view class="stat">
          <text class="stat-value">{{ battles }}</text>
          <text class="stat-label">Battles</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ wins }}</text>
          <text class="stat-label">Wins</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ winRate }}%</text>
          <text class="stat-label">Win Rate</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-candlewars";
const { payGAS } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const betAmount = ref("1");
const prediction = ref<"up" | "down">("up");
const currentPrice = ref(42350);
const priceChange = ref(2.5);
const battles = ref(0);
const wins = ref(0);
const isPredicting = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const candles = ref([
  { type: "up", height: 60 },
  { type: "down", height: 40 },
  { type: "up", height: 70 },
  { type: "up", height: 80 },
  { type: "down", height: 50 },
  { type: "up", height: 65 },
]);

const winRate = computed(() => (battles.value > 0 ? Math.round((wins.value / battles.value) * 100) : 0));

const submitPrediction = async () => {
  if (isPredicting.value) return;
  const amount = parseFloat(betAmount.value);
  if (amount < 0.1) {
    status.value = { msg: "Min bet: 0.1 GAS", type: "error" };
    return;
  }

  isPredicting.value = true;
  try {
    await payGAS(betAmount.value, `candle:${prediction.value}`);
    const rng = await requestRandom();
    const byte = parseInt(rng.randomness.slice(0, 2), 16);
    const priceUp = byte % 2 === 0;
    const won = (priceUp && prediction.value === "up") || (!priceUp && prediction.value === "down");

    battles.value++;
    if (won) {
      wins.value++;
      status.value = { msg: `Correct! Won ${amount * 1.8} GAS`, type: "success" };
    } else {
      status.value = { msg: "Wrong prediction", type: "error" };
    }

    // Update price
    const change = (Math.random() * 5 - 2.5).toFixed(2);
    priceChange.value = parseFloat(change);
    currentPrice.value = Math.round(currentPrice.value * (1 + priceChange.value / 100));
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isPredicting.value = false;
  }
};

onMounted(() => {
  setInterval(() => {
    const change = (Math.random() * 2 - 1).toFixed(2);
    priceChange.value = parseFloat(change);
    currentPrice.value = Math.round(currentPrice.value * (1 + priceChange.value / 100));
  }, 3000);
});
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: #fff;
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
.price-display {
  text-align: center;
  padding: 16px;
  background: rgba($color-gaming, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
}
.price-value {
  font-size: 2em;
  font-weight: bold;
  color: $color-gaming;
  display: block;
}
.price-change {
  font-size: 1.1em;
  margin-top: 8px;
  &.up {
    color: $color-success;
  }
  &.down {
    color: $color-error;
  }
}
.candle-chart {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  height: 120px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}
.candle {
  flex: 1;
  border-radius: 4px;
  &.up {
    background: $color-success;
  }
  &.down {
    background: $color-error;
  }
}
.prediction-row {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}
.pred-btn {
  flex: 1;
  padding: 16px;
  text-align: center;
  border: 2px solid transparent;
  border-radius: 12px;
  &.up {
    background: rgba($color-success, 0.1);
    &.active {
      border-color: $color-success;
      background: rgba($color-success, 0.2);
    }
  }
  &.down {
    background: rgba($color-error, 0.1);
    &.active {
      border-color: $color-error;
      background: rgba($color-error, 0.2);
    }
  }
}
.submit-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.stats-grid {
  display: flex;
  gap: 12px;
}
.stat {
  flex: 1;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-gaming;
  font-size: 1.3em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}
</style>
