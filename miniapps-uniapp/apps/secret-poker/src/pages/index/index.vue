<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Secret Poker</text>
      <text class="subtitle">Hidden card poker game</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your Hand</text>
      <view class="cards-row">
        <view v-for="(card, i) in playerHand" :key="i" :class="['poker-card', card.revealed && 'revealed']">
          <text>{{ card.revealed ? card.value : "🂠" }}</text>
        </view>
      </view>
      <view class="info-row">
        <text class="info-label">Pot:</text>
        <text class="info-value">{{ pot }} GAS</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Actions</text>
      <uni-easyinput v-model="betAmount" type="number" placeholder="Bet amount (GAS)" />
      <view class="actions-row">
        <view class="action-btn" @click="fold" :style="{ opacity: isPlaying ? 0.6 : 1 }">
          <text>Fold</text>
        </view>
        <view class="action-btn primary" @click="bet" :style="{ opacity: isPlaying ? 0.6 : 1 }">
          <text>{{ isPlaying ? "Playing..." : "Bet" }}</text>
        </view>
        <view class="action-btn" @click="reveal" :style="{ opacity: isPlaying ? 0.6 : 1 }">
          <text>Reveal</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Game Stats</text>
      <view class="stats-grid">
        <view class="stat">
          <text class="stat-value">{{ gamesPlayed }}</text>
          <text class="stat-label">Games</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ gamesWon }}</text>
          <text class="stat-label">Won</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ formatNum(totalEarnings) }}</text>
          <text class="stat-label">Earnings</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-secretpoker";
const { payGAS } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const betAmount = ref("1");
const pot = ref(0);
const gamesPlayed = ref(0);
const gamesWon = ref(0);
const totalEarnings = ref(0);
const isPlaying = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const playerHand = ref([
  { value: "A♠", revealed: false },
  { value: "K♥", revealed: false },
  { value: "Q♦", revealed: false },
]);

const formatNum = (n: number) => formatNumber(n, 2);

const bet = async () => {
  if (isPlaying.value) return;
  const amount = parseFloat(betAmount.value);
  if (amount < 0.1) {
    status.value = { msg: "Min bet: 0.1 GAS", type: "error" };
    return;
  }

  isPlaying.value = true;
  try {
    await payGAS(betAmount.value, "poker:bet");
    pot.value += amount;
    status.value = { msg: `Bet ${amount} GAS placed`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isPlaying.value = false;
  }
};

const fold = () => {
  if (isPlaying.value) return;
  pot.value = 0;
  playerHand.value.forEach((c) => (c.revealed = false));
  status.value = { msg: "Folded hand", type: "error" };
};

const reveal = async () => {
  if (isPlaying.value) return;
  isPlaying.value = true;
  try {
    const rng = await requestRandom();
    const byte = parseInt(rng.randomness.slice(0, 2), 16);
    const won = byte % 2 === 0;

    playerHand.value.forEach((c) => (c.revealed = true));
    gamesPlayed.value++;

    if (won) {
      gamesWon.value++;
      totalEarnings.value += pot.value * 2;
      status.value = { msg: `Won ${pot.value * 2} GAS!`, type: "success" };
    } else {
      status.value = { msg: "Lost this round", type: "error" };
    }
    pot.value = 0;
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isPlaying.value = false;
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
.cards-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.poker-card {
  flex: 1;
  aspect-ratio: 2/3;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid $color-border;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  &.revealed {
    background: rgba($color-gaming, 0.2);
    border-color: $color-gaming;
  }
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
}
.info-label {
  color: $color-text-secondary;
}
.info-value {
  color: $color-gaming;
  font-weight: bold;
}
.actions-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.action-btn {
  flex: 1;
  padding: 14px;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border: 1px solid $color-border;
  border-radius: 12px;
  &.primary {
    background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
    border: none;
    font-weight: bold;
  }
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
