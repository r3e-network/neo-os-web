<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Garden of Neo</text>
      <text class="subtitle">Grow and trade virtual garden NFTs</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your Garden</text>
      <view class="garden-grid">
        <view
          v-for="plot in plots"
          :key="plot.id"
          class="plot"
          :class="{ empty: !plot.plant }"
          @click="selectPlot(plot)"
        >
          <text v-if="plot.plant" class="plant-icon">{{ plot.plant.icon }}</text>
          <text v-else class="empty-icon">🌱</text>
          <view v-if="plot.plant" class="growth-bar">
            <view class="growth-fill" :style="{ width: plot.plant.growth + '%' }"></view>
          </view>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Available Seeds</text>
      <view class="seeds-list">
        <view v-for="seed in seeds" :key="seed.id" class="seed-item" @click="plantSeed(seed)">
          <text class="seed-icon">{{ seed.icon }}</text>
          <view class="seed-info">
            <text class="seed-name">{{ seed.name }}</text>
            <text class="seed-time">{{ seed.growTime }}h to grow</text>
          </view>
          <text class="seed-price">{{ seed.price }} GAS</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Actions</text>
      <view class="action-btns">
        <view class="btn-primary" @click="waterGarden" :style="{ opacity: isLoading ? 0.6 : 1 }">
          <text>{{ isLoading ? "Watering..." : "Water All (2 GAS)" }}</text>
        </view>
        <view class="btn-secondary" @click="harvestAll">
          <text>Harvest Ready Plants</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Garden Stats</text>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">{{ totalPlants }}</text>
          <text class="stat-label">Plants</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ readyToHarvest }}</text>
          <text class="stat-label">Ready</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ totalHarvested }}</text>
          <text class="stat-label">Harvested</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-gardenofneo";
const { payGAS, isLoading } = usePayments(APP_ID);

interface Plant {
  icon: string;
  name: string;
  growth: number;
}

interface Plot {
  id: string;
  plant: Plant | null;
}

const plots = ref<Plot[]>([
  { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
  { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
  { id: "3", plant: null },
  { id: "4", plant: null },
  { id: "5", plant: { icon: "🌷", name: "Tulip", growth: 100 } },
  { id: "6", plant: null },
]);

const seeds = ref([
  { id: "1", name: "Sunflower", icon: "🌻", price: "3", growTime: 24 },
  { id: "2", name: "Rose", icon: "🌹", price: "5", growTime: 48 },
  { id: "3", name: "Tulip", icon: "🌷", price: "4", growTime: 36 },
  { id: "4", name: "Orchid", icon: "🌺", price: "8", growTime: 72 },
]);

const status = ref<{ msg: string; type: string } | null>(null);
const totalHarvested = ref(12);
const selectedPlot = ref<Plot | null>(null);

const totalPlants = computed(() => plots.value.filter((p) => p.plant).length);
const readyToHarvest = computed(() => plots.value.filter((p) => p.plant && p.plant.growth >= 100).length);

const selectPlot = (plot: Plot) => {
  selectedPlot.value = plot;
  if (plot.plant && plot.plant.growth >= 100) {
    harvest(plot);
  }
};

const plantSeed = async (seed: any) => {
  const emptyPlot = plots.value.find((p) => !p.plant);
  if (!emptyPlot) {
    status.value = { msg: "No empty plots available", type: "error" };
    return;
  }
  if (isLoading.value) return;
  try {
    status.value = { msg: "Planting seed...", type: "loading" };
    await payGAS(seed.price, `plant:${seed.id}`);
    emptyPlot.plant = { icon: seed.icon, name: seed.name, growth: 0 };
    status.value = { msg: `${seed.name} planted!`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const waterGarden = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Watering garden...", type: "loading" };
    await payGAS("2", `water:${Date.now()}`);
    plots.value.forEach((plot) => {
      if (plot.plant && plot.plant.growth < 100) {
        plot.plant.growth = Math.min(100, plot.plant.growth + 20);
      }
    });
    status.value = { msg: "Garden watered!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const harvest = (plot: Plot) => {
  if (!plot.plant || plot.plant.growth < 100) return;
  status.value = { msg: `Harvested ${plot.plant.name}!`, type: "success" };
  plot.plant = null;
  totalHarvested.value++;
};

const harvestAll = () => {
  let count = 0;
  plots.value.forEach((plot) => {
    if (plot.plant && plot.plant.growth >= 100) {
      plot.plant = null;
      count++;
    }
  });
  if (count > 0) {
    totalHarvested.value += count;
    status.value = { msg: `Harvested ${count} plants!`, type: "success" };
  } else {
    status.value = { msg: "No plants ready to harvest", type: "error" };
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
.garden-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.plot {
  aspect-ratio: 1;
  background: rgba($color-nft, 0.15);
  border: 2px solid $color-nft;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  &.empty {
    border-style: dashed;
    opacity: 0.5;
  }
}
.plant-icon {
  font-size: 2.5em;
  margin-bottom: 8px;
}
.empty-icon {
  font-size: 2em;
  opacity: 0.4;
}
.growth-bar {
  width: 80%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}
.growth-fill {
  height: 100%;
  background: $color-nft;
}
.seeds-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.seed-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
}
.seed-icon {
  font-size: 1.8em;
  margin-right: 12px;
}
.seed-info {
  flex: 1;
}
.seed-name {
  display: block;
  font-weight: bold;
}
.seed-time {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.seed-price {
  color: $color-nft;
  font-weight: bold;
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
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.stat-item {
  text-align: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
}
.stat-value {
  display: block;
  font-size: 1.5em;
  font-weight: bold;
  color: $color-nft;
  margin-bottom: 4px;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.85em;
}
</style>
