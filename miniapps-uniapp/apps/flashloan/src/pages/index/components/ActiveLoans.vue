<template>
  <view class="active-loans">
    <NeoCard class="mb-4" variant="erobo">
      <FlowVisualization />
    </NeoCard>

    <LiquidityPoolCard :pool-balance="poolBalance" class="mb-4" />

    <NeoCard variant="erobo">
      <StatsDisplay :items="statsItems" layout="grid" :columns="2" />
    </NeoCard>

    <RecentLoansTable :recent-loans="recentLoans" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, StatsDisplay } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";
import FlowVisualization from "./FlowVisualization.vue";
import LiquidityPoolCard from "./LiquidityPoolCard.vue";
import RecentLoansTable from "./RecentLoansTable.vue";

const { t } = createUseI18n(messages)();
const formatNum = (n: number) => formatNumber(n, 2);

const props = defineProps<{
  poolBalance: number;
  stats: { totalLoans: number; totalVolume: number; totalFees: number };
  recentLoans: Array<{ id: number; amount: number; fee: number; status: string; timestamp: string }>;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

const statsItems = computed<StatsDisplayItem[]>(() => [
  { label: t("totalLoans"), value: props.stats.totalLoans },
  { label: t("totalVolume"), value: formatNum(props.stats.totalVolume) },
  { label: t("totalFees"), value: props.stats.totalFees.toFixed(4) },
  {
    label: t("avgLoanSize"),
    value: props.stats.totalLoans > 0 ? formatNum(props.stats.totalVolume / props.stats.totalLoans) : "0",
  },
]);
</script>
