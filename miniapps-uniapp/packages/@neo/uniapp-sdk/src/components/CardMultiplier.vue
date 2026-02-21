<template>
  <view class="card-multiplier" :class="data.status">
    <view class="multiplier-display">
      <text class="multiplier-value">{{ multiplier }}x</text>
      <text class="status-badge">{{ statusText }}</text>
    </view>
    <view class="game-info">
      <text>{{ data.playersCount }} players</text>
      <text>{{ data.totalBets }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MultiplierData } from "../card-types";

const props = defineProps<{ data: MultiplierData }>();

const multiplier = computed(() => props.data.currentMultiplier.toFixed(2));
const statusText = computed(() => {
  const map = { waiting: "Starting...", running: "LIVE", crashed: "Crashed!" };
  return map[props.data.status];
});
</script>

<style scoped lang="scss">
.card-multiplier {
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  text-align: center;
  &.waiting {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  }
  &.running {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
  &.crashed {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }
}
.multiplier-display {
  margin-bottom: 12px;
}
.multiplier-value {
  font-size: 2.5em;
  font-weight: bold;
  display: block;
}
.status-badge {
  font-size: 0.75em;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
.game-info {
  display: flex;
  justify-content: space-around;
  font-size: 0.85em;
  opacity: 0.9;
}
</style>
