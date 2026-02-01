<template>
  <view class="card-price">
    <view class="price-header">
      <text class="symbol">{{ data.symbol }}</text>
      <text class="change" :class="data.change24h >= 0 ? 'up' : 'down'">
        {{ data.change24h >= 0 ? "+" : "" }}{{ data.change24h.toFixed(2) }}%
      </text>
    </view>
    <text class="price-value">${{ data.price }}</text>
    <view class="sparkline">
      <view
        v-for="(val, idx) in normalizedSparkline"
        :key="idx"
        class="spark-bar"
        :style="{ height: val + '%' }"
        :class="data.change24h >= 0 ? 'up' : 'down'"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PriceData } from "../card-types";

const props = defineProps<{ data: PriceData }>();

const normalizedSparkline = computed(() => {
  const { sparkline } = props.data;
  const min = Math.min(...sparkline);
  const max = Math.max(...sparkline);
  const range = max - min || 1;
  return sparkline.map((v) => 20 + ((v - min) / range) * 80);
});
</script>

<style scoped lang="scss">
.card-price {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 12px;
  padding: 14px;
  color: #fff;
}
.price-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.symbol {
  font-size: 0.85em;
  font-weight: 600;
  opacity: 0.9;
}
.change {
  font-size: 0.8em;
  padding: 2px 6px;
  border-radius: 4px;
  &.up {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
  &.down {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
}
.price-value {
  font-size: 1.6em;
  font-weight: bold;
  display: block;
  margin-bottom: 10px;
}
.sparkline {
  display: flex;
  align-items: flex-end;
  height: 40px;
  gap: 2px;
}
.spark-bar {
  flex: 1;
  border-radius: 1px;
  &.up {
    background: #10b981;
  }
  &.down {
    background: #ef4444;
  }
}
</style>
