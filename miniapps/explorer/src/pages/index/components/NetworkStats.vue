<template>
  <view class="stats-grid mb-6">
    <MiniAppTabStats :title="t('mainnet')" variant="erobo" class="flex-1" :stats="mainnetStats" />
    <MiniAppTabStats :title="t('testnet')" variant="erobo-neo" class="flex-1" :stats="testnetStats" />
  </view>
</template>

<script setup lang="ts">
import { MiniAppTabStats, type StatItem } from "@shared/components";

defineProps<{
  mainnetStats: StatItem[];
  testnetStats: StatItem[];
  t: (key: string, ...args: unknown[]) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.flex-1 {
  flex: 1;
}
.mb-6 {
  margin-bottom: 24px;
}
</style>
