<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Coin Flip</text>
      <text class="subtitle">50/50 chance to double</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="stats-row">
        <view class="stat"
          ><text class="stat-value">{{ wins }}</text
          ><text class="stat-label">Wins</text></view
        >
        <view class="stat"
          ><text class="stat-value">{{ losses }}</text
          ><text class="stat-label">Losses</text></view
        >
        <view class="stat"
          ><text class="stat-value">{{ formatNum(totalWon) }}</text
          ><text class="stat-label">Won</text></view
        >
      </view>
    </view>
    <view class="card">
      <text class="card-title">Place Bet</text>
      <uni-easyinput v-model="betAmount" type="number" placeholder="Bet amount (GAS)" />
      <view class="choice-row">
        <view :class="['choice-btn', choice === 'heads' && 'active']" @click="choice = 'heads'">
          <text>🪙 Heads</text>
        </view>
        <view :class="['choice-btn', choice === 'tails' && 'active']" @click="choice = 'tails'">
          <text>🔴 Tails</text>
        </view>
      </view>
      <view class="flip-btn" @click="flip" :style="{ opacity: isFlipping ? 0.6 : 1 }">
        <text>{{ isFlipping ? "Flipping..." : "Flip Coin" }}</text>
      </view>
    </view>
    <view v-if="result" class="result-card">
      <text class="result-text">{{ result.won ? "🎉 You Won!" : "😢 You Lost" }}</text>
      <text class="result-outcome">{{ result.outcome }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-coinflip";
const { payGAS } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const betAmount = ref("1");
const choice = ref<"heads" | "tails">("heads");
const wins = ref(0);
const losses = ref(0);
const totalWon = ref(0);
const isFlipping = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
const result = ref<{ won: boolean; outcome: string } | null>(null);

const formatNum = (n: number) => formatNumber(n, 2);

const flip = async () => {
  if (isFlipping.value) return;
  const amount = parseFloat(betAmount.value);
  if (amount < 0.1) {
    status.value = { msg: "Min bet: 0.1 GAS", type: "error" };
    return;
  }

  isFlipping.value = true;
  result.value = null;
  try {
    await payGAS(betAmount.value, `coinflip:${choice.value}`);
    const rng = await requestRandom();
    const byte = parseInt(rng.randomness.slice(0, 2), 16);
    const outcome = byte % 2 === 0 ? "heads" : "tails";
    const won = outcome === choice.value;

    result.value = { won, outcome: outcome.toUpperCase() };
    if (won) {
      wins.value++;
      totalWon.value += amount;
      status.value = { msg: `Won ${amount * 2} GAS!`, type: "success" };
    } else {
      losses.value++;
      status.value = { msg: "Better luck next time", type: "error" };
    }
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isFlipping.value = false;
  }
};
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
.stats-row {
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
.choice-row {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}
.choice-btn {
  flex: 1;
  padding: 16px;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border: 2px solid transparent;
  border-radius: 12px;
  &.active {
    border-color: $color-gaming;
    background: rgba($color-gaming, 0.2);
  }
}
.flip-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.result-card {
  background: rgba($color-gaming, 0.15);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}
.result-text {
  font-size: 1.5em;
  font-weight: bold;
  display: block;
  margin-bottom: 8px;
}
.result-outcome {
  color: $color-gaming;
  font-size: 1.2em;
}
</style>
