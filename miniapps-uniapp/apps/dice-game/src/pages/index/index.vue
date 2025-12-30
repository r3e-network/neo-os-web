<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dice Game</text>
      <text class="subtitle">Roll the dice, win big</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="dice-display">
        <text class="dice">🎲 {{ lastRoll || "?" }}</text>
      </view>
      <text class="card-title">Predict: Over/Under</text>
      <view class="target-row">
        <text>Target: {{ target }}</text>
        <uni-slider v-model="target" :min="2" :max="12" />
      </view>
      <view class="choice-row">
        <view :class="['choice-btn', prediction === 'over' && 'active']" @click="prediction = 'over'">
          <text>Over {{ target }}</text>
        </view>
        <view :class="['choice-btn', prediction === 'under' && 'active']" @click="prediction = 'under'">
          <text>Under {{ target }}</text>
        </view>
      </view>
      <uni-easyinput v-model="betAmount" type="number" placeholder="Bet (GAS)" />
      <view class="roll-btn" @click="roll">
        <text>{{ isRolling ? "Rolling..." : "Roll Dice" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-dicegame";
const { payGAS } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const betAmount = ref("1");
const target = ref(7);
const prediction = ref<"over" | "under">("over");
const lastRoll = ref<number | null>(null);
const isRolling = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const roll = async () => {
  if (isRolling.value) return;
  isRolling.value = true;
  try {
    await payGAS(betAmount.value, `dice:${prediction.value}:${target.value}`);
    const rng = await requestRandom();
    const d1 = (parseInt(rng.randomness.slice(0, 2), 16) % 6) + 1;
    const d2 = (parseInt(rng.randomness.slice(2, 4), 16) % 6) + 1;
    lastRoll.value = d1 + d2;
    const won = prediction.value === "over" ? lastRoll.value > target.value : lastRoll.value < target.value;
    status.value = {
      msg: won ? `Won! Rolled ${lastRoll.value}` : `Lost. Rolled ${lastRoll.value}`,
      type: won ? "success" : "error",
    };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isRolling.value = false;
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
  margin: 16px 0 12px;
}
.dice-display {
  text-align: center;
  padding: 20px;
}
.dice {
  font-size: 3em;
}
.target-row {
  margin-bottom: 16px;
}
.choice-row {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}
.choice-btn {
  flex: 1;
  padding: 14px;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border: 2px solid transparent;
  border-radius: 12px;
  &.active {
    border-color: $color-gaming;
  }
}
.roll-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 16px;
}
</style>
