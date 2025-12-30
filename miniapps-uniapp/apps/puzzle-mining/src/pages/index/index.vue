<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Puzzle Mining</text>
      <text class="subtitle">Mining puzzle game</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Mining Progress</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: miningProgress + '%' }"></view>
      </view>
      <view class="progress-text">
        <text>{{ miningProgress }}% Complete</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Puzzle Challenge</text>
      <view class="puzzle-grid">
        <view
          v-for="(piece, i) in puzzlePieces"
          :key="i"
          :class="['puzzle-piece', piece.solved && 'solved']"
          @click="solvePiece(i)"
        >
          <text>{{ piece.value }}</text>
        </view>
      </view>
      <view class="mine-btn" @click="startMining" :style="{ opacity: isMining ? 0.6 : 1 }">
        <text>{{ isMining ? "Mining..." : "Start Mining" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Mining Stats</text>
      <view class="stats-grid">
        <view class="stat">
          <text class="stat-value">{{ blocksMinedCount }}</text>
          <text class="stat-label">Blocks</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ formatNum(totalRewards) }}</text>
          <text class="stat-label">Rewards</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ puzzlesSolved }}</text>
          <text class="stat-label">Puzzles</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-puzzlemining";
const { payGAS } = usePayments(APP_ID);
const { requestRandom } = useRNG(APP_ID);

const miningProgress = ref(0);
const blocksMinedCount = ref(0);
const totalRewards = ref(0);
const puzzlesSolved = ref(0);
const isMining = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const puzzlePieces = ref([
  { value: "🔷", solved: false },
  { value: "🔶", solved: false },
  { value: "🔷", solved: false },
  { value: "🔶", solved: false },
  { value: "🔷", solved: false },
  { value: "🔶", solved: false },
  { value: "🔷", solved: false },
  { value: "🔶", solved: false },
  { value: "🔷", solved: false },
]);

const formatNum = (n: number) => formatNumber(n, 2);

const solvePiece = (index: number) => {
  if (puzzlePieces.value[index].solved) return;
  puzzlePieces.value[index].solved = true;
  puzzlesSolved.value++;
  miningProgress.value = Math.min(100, miningProgress.value + 11);
  status.value = { msg: `Puzzle piece ${index + 1} solved!`, type: "success" };
};

const startMining = async () => {
  if (isMining.value) return;
  const unsolvedCount = puzzlePieces.value.filter((p) => !p.solved).length;
  if (unsolvedCount > 3) {
    status.value = { msg: "Solve more puzzles first", type: "error" };
    return;
  }

  isMining.value = true;
  try {
    await payGAS("0.5", "mining:start");
    const rng = await requestRandom();
    const byte = parseInt(rng.randomness.slice(0, 2), 16);
    const reward = (byte % 10) / 10 + 0.5;

    blocksMinedCount.value++;
    totalRewards.value += reward;
    miningProgress.value = 0;
    puzzlePieces.value.forEach((p) => (p.solved = false));
    status.value = { msg: `Mined! Earned ${reward.toFixed(2)} GAS`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  } finally {
    isMining.value = false;
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
.progress-bar {
  height: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-gaming 0%, lighten($color-gaming, 10%) 100%);
  transition: width 0.3s ease;
}
.progress-text {
  text-align: center;
  color: $color-text-secondary;
  font-size: 0.9em;
}
.puzzle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}
.puzzle-piece {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid $color-border;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2em;
  &.solved {
    background: rgba($color-gaming, 0.2);
    border-color: $color-gaming;
  }
}
.mine-btn {
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
