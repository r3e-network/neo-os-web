<template>
  <view class="card-stats">
    <view v-for="(stat, idx) in data.stats" :key="idx" class="stat-item">
      <text v-if="stat.icon" class="stat-icon">{{ stat.icon }}</text>
      <view class="stat-content">
        <text class="stat-value">{{ stat.value }}</text>
        <text class="stat-label">{{ stat.label }}</text>
      </view>
      <text v-if="stat.change" class="stat-change" :class="stat.change > 0 ? 'up' : 'down'">
        {{ stat.change > 0 ? "+" : "" }}{{ stat.change.toFixed(1) }}%
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { StatsData } from "../card-types";

defineProps<{ data: StatsData }>();
</script>

<style scoped lang="scss">
.card-stats {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-radius: 12px;
  padding: 12px;
  color: #fff;
}
.stat-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
}
.stat-icon {
  font-size: 1.5em;
  margin-right: 10px;
}
.stat-content {
  flex: 1;
}
.stat-value {
  font-size: 1.2em;
  font-weight: bold;
  display: block;
}
.stat-label {
  font-size: 0.75em;
  opacity: 0.8;
}
.stat-change {
  font-size: 0.85em;
  padding: 2px 6px;
  border-radius: 4px;
  &.up {
    background: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }
  &.down {
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
}
</style>
