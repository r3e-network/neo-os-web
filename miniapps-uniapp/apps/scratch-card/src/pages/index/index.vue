<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Scratch Card</text>
      <text class="subtitle">Instant win prizes</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="scratch-area" @click="scratch">
        <text v-if="!revealed" class="scratch-text">🎫 Tap to Scratch</text>
        <text v-else class="prize-text">{{ prize > 0 ? `🎉 ${prize} GAS!` : "😢 No Win" }}</text>
      </view>
      <view class="buy-btn" @click="buyCard" v-if="revealed || !hasCard">
        <text>{{ isLoading ? "Buying..." : "Buy Card (1 GAS)" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Your Stats</text>
      <view class="stats-row">
        <view class="stat"
          ><text class="stat-value">{{ cardsScratched }}</text
          ><text class="stat-label">Scratched</text></view
        >
        <view class="stat"
          ><text class="stat-value">{{ totalWon }}</text
          ><text class="stat-label">Won (GAS)</text></view
        >
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-scratchcard";
const { payGAS, isLoading } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const hasCard = ref(false);
const revealed = ref(false);
const prize = ref(0);
const cardsScratched = ref(0);
const totalWon = ref(0);
const status = ref<{ msg: string; type: string } | null>(null);

const buyCard = async () => {
  if (isLoading.value) return;
  try {
    await payGAS("1", "scratchcard:buy");
    hasCard.value = true;
    revealed.value = false;
    prize.value = 0;
    status.value = { msg: "Card purchased!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const scratch = async () => {
  if (!hasCard.value || revealed.value) return;
  try {
    const rng = await requestRandom();
    const val = parseInt(rng.randomness.slice(0, 4), 16) % 100;
    prize.value = val < 5 ? 10 : val < 20 ? 2 : val < 40 ? 1 : 0;
    revealed.value = true;
    cardsScratched.value++;
    if (prize.value > 0) totalWon.value += prize.value;
    hasCard.value = false;
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
.scratch-area {
  background: linear-gradient(135deg, rgba($color-gaming, 0.3) 0%, rgba($color-gaming, 0.1) 100%);
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  margin-bottom: 16px;
}
.scratch-text {
  font-size: 1.5em;
  color: $color-gaming;
}
.prize-text {
  font-size: 2em;
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
</style>
