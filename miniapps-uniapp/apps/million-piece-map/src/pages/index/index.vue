<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Million Piece Map</text>
      <text class="subtitle">Tile ownership game</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Map Grid</text>
      <view class="map-grid">
        <view
          v-for="(tile, i) in tiles"
          :key="i"
          :class="['tile', tile.owned && 'owned', tile.selected && 'selected']"
          @click="selectTile(i)"
        >
          <text v-if="tile.owned">{{ tile.owner }}</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Purchase Tile</text>
      <view class="tile-info">
        <text class="info-text">Selected: Tile #{{ selectedTile }}</text>
        <text class="info-text">Price: {{ tilePrice }} GAS</text>
      </view>
      <view class="purchase-btn" @click="purchaseTile" :style="{ opacity: isPurchasing ? 0.6 : 1 }">
        <text>{{ isPurchasing ? "Purchasing..." : "Purchase Tile" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Your Stats</text>
      <view class="stats-grid">
        <view class="stat">
          <text class="stat-value">{{ ownedTiles }}</text>
          <text class="stat-label">Owned</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ formatNum(totalSpent) }}</text>
          <text class="stat-label">Spent</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ coverage }}%</text>
          <text class="stat-label">Coverage</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-millionpiecemap";
const { payGAS } = usePayments(APP_ID);

const GRID_SIZE = 64;
const tiles = ref(
  Array.from({ length: GRID_SIZE }, (_, i) => ({
    owned: i % 7 === 0,
    owner: i % 7 === 0 ? "👤" : "",
    selected: false,
  })),
);

const selectedTile = ref(0);
const tilePrice = ref(0.5);
const ownedTiles = ref(9);
const totalSpent = ref(4.5);
const isPurchasing = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const coverage = computed(() => Math.round((ownedTiles.value / GRID_SIZE) * 100));
const formatNum = (n: number) => formatNumber(n, 2);

const selectTile = (index: number) => {
  tiles.value.forEach((t, i) => (t.selected = i === index));
  selectedTile.value = index;
};

const purchaseTile = async () => {
  if (isPurchasing.value) return;
  if (tiles.value[selectedTile.value].owned) {
    status.value = { msg: "Tile already owned", type: "error" };
    return;
  }

  isPurchasing.value = true;
  try {
    await payGAS(tilePrice.value.toString(), `map:tile:${selectedTile.value}`);
    tiles.value[selectedTile.value].owned = true;
    tiles.value[selectedTile.value].owner = "🎯";
    ownedTiles.value++;
    totalSpent.value += tilePrice.value;
    status.value = { msg: `Tile #${selectedTile.value} purchased!`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isPurchasing.value = false;
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
.map-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}
.tile {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid $color-border;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  &.owned {
    background: rgba($color-gaming, 0.2);
    border-color: $color-gaming;
  }
  &.selected {
    border: 2px solid $color-gaming;
    box-shadow: 0 0 8px rgba($color-gaming, 0.5);
  }
}
.tile-info {
  padding: 16px;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
}
.info-text {
  display: block;
  color: $color-text-primary;
  margin-bottom: 8px;
  &:last-child {
    margin-bottom: 0;
    color: $color-gaming;
    font-weight: bold;
  }
}
.purchase-btn {
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
