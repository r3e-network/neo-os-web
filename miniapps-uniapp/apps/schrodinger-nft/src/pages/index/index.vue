<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Schrodinger NFT</text>
      <text class="subtitle">Mystery boxes until revealed</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Mystery Boxes</text>
      <view class="boxes-grid">
        <view v-for="box in boxes" :key="box.id" class="mystery-box" @click="reveal(box)">
          <text v-if="box.revealed" class="box-revealed">{{ box.content }}</text>
          <view v-else class="box-mystery">
            <text class="box-icon">📦</text>
            <text class="box-rarity">{{ box.rarity }}</text>
          </view>
        </view>
      </view>
      <view class="buy-btn" @click="buyBox" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Minting..." : "Buy Mystery Box (5 GAS)" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Possible Rewards</text>
      <view class="rewards-list">
        <view v-for="(r, i) in rewards" :key="i" class="reward-item">
          <text class="reward-icon">{{ r.icon }}</text>
          <text class="reward-name">{{ r.name }}</text>
          <text class="reward-chance">{{ r.chance }}%</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-schrodingernft";
const { payGAS, isLoading } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

interface Box {
  id: string;
  rarity: string;
  revealed: boolean;
  content?: string;
}

const boxes = ref<Box[]>([
  { id: "1", rarity: "Common", revealed: false },
  { id: "2", rarity: "Rare", revealed: false },
]);
const status = ref<{ msg: string; type: string } | null>(null);
const rewards = ref([
  { icon: "🐉", name: "Legendary Dragon", chance: 5 },
  { icon: "⚔️", name: "Epic Sword", chance: 15 },
  { icon: "💎", name: "Rare Gem", chance: 30 },
  { icon: "🪙", name: "Common Coin", chance: 50 },
]);

const reveal = async (box: Box) => {
  if (box.revealed) return;
  try {
    status.value = { msg: "Revealing...", type: "loading" };
    const rand = await requestRandom(`reveal:${box.id}`);
    const roll = (rand % 100) + 1;
    box.content = roll <= 5 ? "🐉" : roll <= 20 ? "⚔️" : roll <= 50 ? "💎" : "🪙";
    box.revealed = true;
    status.value = { msg: "Revealed!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const buyBox = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Minting box...", type: "loading" };
    await payGAS("5", `mint:${Date.now()}`);
    boxes.value.push({
      id: Date.now().toString(),
      rarity: Math.random() > 0.7 ? "Rare" : "Common",
      revealed: false,
    });
    status.value = { msg: "Box minted!", type: "success" };
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
.boxes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.mystery-box {
  aspect-ratio: 1;
  background: rgba($color-nft, 0.1);
  border: 2px solid $color-nft;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.box-mystery {
  text-align: center;
}
.box-icon {
  display: block;
  font-size: 3em;
  margin-bottom: 8px;
}
.box-rarity {
  color: $color-nft;
  font-size: 0.85em;
}
.box-revealed {
  font-size: 4em;
}
.buy-btn {
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.rewards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reward-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
}
.reward-icon {
  font-size: 1.5em;
  margin-right: 12px;
}
.reward-name {
  flex: 1;
}
.reward-chance {
  color: $color-nft;
  font-weight: bold;
}
</style>
