<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Pixel Canvas</text>
      <text class="subtitle">Collaborative pixel art creation</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Canvas Grid</text>
      <view class="canvas-grid">
        <view
          v-for="(pixel, idx) in pixels"
          :key="idx"
          class="pixel"
          :style="{ background: pixel }"
          @click="paintPixel(idx)"
        ></view>
      </view>
      <view class="color-palette">
        <view
          v-for="c in colors"
          :key="c"
          class="color-btn"
          :class="{ active: selectedColor === c }"
          :style="{ background: c }"
          @click="selectedColor = c"
        ></view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Actions</text>
      <view class="action-btns">
        <view class="btn-primary" @click="mintCanvas" :style="{ opacity: isLoading ? 0.6 : 1 }">
          <text>{{ isLoading ? "Minting..." : "Mint as NFT (10 GAS)" }}</text>
        </view>
        <view class="btn-secondary" @click="clearCanvas">
          <text>Clear Canvas</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Recent Artworks</text>
      <view class="artworks-list">
        <view v-for="art in artworks" :key="art.id" class="artwork-item">
          <text class="artwork-icon">🎨</text>
          <view class="artwork-info">
            <text class="artwork-name">{{ art.name }}</text>
            <text class="artwork-author">by {{ art.author }}</text>
          </view>
          <text class="artwork-price">{{ art.price }} GAS</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-canvas";
const { payGAS, isLoading } = usePayments(APP_ID);

const GRID_SIZE = 16;
const pixels = ref<string[]>(Array(GRID_SIZE * GRID_SIZE).fill("#1a1a2e"));
const selectedColor = ref("#00ff88");
const colors = ["#00ff88", "#ff0055", "#ffaa00", "#00aaff", "#ff00ff", "#ffffff"];
const status = ref<{ msg: string; type: string } | null>(null);
const artworks = ref([
  { id: "1", name: "Sunset", author: "Alice", price: "15" },
  { id: "2", name: "Ocean", author: "Bob", price: "20" },
  { id: "3", name: "Forest", author: "Carol", price: "12" },
]);

const paintPixel = (idx: number) => {
  pixels.value[idx] = selectedColor.value;
};

const clearCanvas = () => {
  pixels.value = Array(GRID_SIZE * GRID_SIZE).fill("#1a1a2e");
  status.value = { msg: "Canvas cleared", type: "success" };
};

const mintCanvas = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Minting NFT...", type: "loading" };
    await payGAS("10", `mint:${Date.now()}`);
    status.value = { msg: "Canvas minted as NFT!", type: "success" };
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
.canvas-grid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 2px;
  margin-bottom: 16px;
  aspect-ratio: 1;
}
.pixel {
  aspect-ratio: 1;
  border-radius: 2px;
}
.color-palette {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.color-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid transparent;
  &.active {
    border-color: $color-nft;
  }
}
.action-btns {
  display: flex;
  gap: 12px;
}
.btn-primary {
  flex: 1;
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.btn-secondary {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
}
.artworks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.artwork-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
}
.artwork-icon {
  font-size: 1.8em;
  margin-right: 12px;
}
.artwork-info {
  flex: 1;
}
.artwork-name {
  display: block;
  font-weight: bold;
}
.artwork-author {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.artwork-price {
  color: $color-nft;
  font-weight: bold;
}
</style>
