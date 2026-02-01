<template>
  <view class="active-loans">
    <NeoCard class="mb-4" variant="erobo">
      <FlowVisualization :t="t" />
    </NeoCard>

    <LiquidityPoolCard :pool-balance="poolBalance" :t="t" class="mb-4" />

    <SimulationStats :stats="stats" :t="t" />

    <RecentLoansTable :recent-loans="recentLoans" :t="t" />
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import FlowVisualization from "./FlowVisualization.vue";
import LiquidityPoolCard from "./LiquidityPoolCard.vue";
import SimulationStats from "./SimulationStats.vue";
import RecentLoansTable from "./RecentLoansTable.vue";

defineProps<{
  poolBalance: number;
  stats: { totalLoans: number; totalVolume: number; totalFees: number };
  recentLoans: Array<{ id: number; amount: number; fee: number; status: string; timestamp: string }>;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();
</script>
