<template>
  <view class="app-container">
    <view class="header">
      <text class="title">On-Chain Tarot</text>
      <text class="subtitle">Blockchain-powered divination</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Draw Your Cards</text>
      <view class="cards-row">
        <view v-for="(card, i) in drawn" :key="i" class="tarot-card" @click="flipCard(i)">
          <text v-if="card.flipped" class="card-face">{{ card.icon }}</text>
          <view v-else class="card-back">
            <text class="card-pattern">🌙</text>
          </view>
          <text v-if="card.flipped" class="card-name">{{ card.name }}</text>
        </view>
      </view>
      <view v-if="!hasDrawn" class="draw-btn" @click="draw" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Drawing..." : "Draw 3 Cards (2 GAS)" }}</text>
      </view>
      <view v-else class="reset-btn" @click="reset">
        <text>Draw Again</text>
      </view>
    </view>
    <view v-if="hasDrawn && allFlipped" class="card">
      <text class="card-title">Your Reading</text>
      <text class="reading-text">{{ getReading() }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-onchaintarot";
const { payGAS, isLoading } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

interface Card {
  name: string;
  icon: string;
  flipped: boolean;
}

const tarotDeck = [
  { name: "The Fool", icon: "🃏" },
  { name: "The Magician", icon: "🎩" },
  { name: "The High Priestess", icon: "🔮" },
  { name: "The Empress", icon: "👑" },
  { name: "The Emperor", icon: "⚔️" },
  { name: "The Lovers", icon: "💕" },
  { name: "The Chariot", icon: "🏇" },
  { name: "Strength", icon: "🦁" },
  { name: "The Hermit", icon: "🕯️" },
  { name: "Wheel of Fortune", icon: "☸️" },
  { name: "Justice", icon: "⚖️" },
  { name: "The Hanged Man", icon: "🙃" },
  { name: "Death", icon: "💀" },
  { name: "Temperance", icon: "🍷" },
  { name: "The Devil", icon: "😈" },
  { name: "The Tower", icon: "🗼" },
  { name: "The Star", icon: "⭐" },
  { name: "The Moon", icon: "🌙" },
  { name: "The Sun", icon: "☀️" },
  { name: "Judgement", icon: "📯" },
  { name: "The World", icon: "🌍" },
];

const drawn = ref<Card[]>([]);
const status = ref<{ msg: string; type: string } | null>(null);
const hasDrawn = computed(() => drawn.value.length === 3);
const allFlipped = computed(() => drawn.value.every((c) => c.flipped));

const draw = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Drawing cards...", type: "loading" };
    await payGAS("2", `draw:${Date.now()}`);
    const rand = await requestRandom(`tarot:${Date.now()}`);
    const indices = [rand % 22, (rand * 7) % 22, (rand * 13) % 22];
    drawn.value = indices.map((i) => ({ ...tarotDeck[i], flipped: false }));
    status.value = { msg: "Cards drawn!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const flipCard = (index: number) => {
  if (drawn.value[index]) {
    drawn.value[index].flipped = true;
  }
};

const reset = () => {
  drawn.value = [];
  status.value = null;
};

const getReading = () => {
  return "Your past shows transformation, present reveals balance, and future promises new beginnings. Trust the journey ahead.";
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
  color: $color-nft;
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
  color: $color-nft;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}
.cards-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}
.tarot-card {
  width: 90px;
  height: 140px;
  background: rgba($color-nft, 0.1);
  border: 2px solid $color-nft;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.card-back {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba($color-nft, 0.3), rgba($color-nft, 0.1));
}
.card-pattern {
  font-size: 2em;
}
.card-face {
  font-size: 3em;
  margin-bottom: 8px;
}
.card-name {
  font-size: 0.7em;
  color: $color-nft;
  text-align: center;
  padding: 0 4px;
}
.draw-btn {
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.reset-btn {
  background: rgba($color-nft, 0.2);
  color: $color-nft;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.reading-text {
  color: $color-text-primary;
  line-height: 1.6;
  display: block;
}
</style>
