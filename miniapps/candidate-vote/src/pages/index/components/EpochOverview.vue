<template>
  <NeoCard variant="erobo">
    <NeoStats :stats="epochStats" />
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoStats, type StatItem } from "@shared/components";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  currentEpoch: number;
  epochEndTime: number;
  epochTotalVotes: number;
  currentStrategy: string;
  t: (key: string) => string;
}>();

const formatNeo = (value: number) => formatNumber(value / 1e8, 2);

const toMillis = (value: number) => (value > 1_000_000_000_000 ? value : value * 1000);

const epochEndsIn = computed(() => {
  if (!props.epochEndTime) return "--";
  const diff = toMillis(props.epochEndTime) - Date.now();
  if (diff <= 0) return props.t("epochEnded");
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
});

const strategyLabel = computed(() => {
  if (props.currentStrategy === "self") return props.t("strategySelf");
  if (props.currentStrategy === "neoburger") return props.t("strategyNeoBurger");
  return props.currentStrategy || "--";
});

const epochStats = computed<StatItem[]>(() => [
  { label: props.t("currentEpoch"), value: props.currentEpoch || "--" },
  { label: props.t("epochEndsIn"), value: epochEndsIn.value, variant: "warning" },
  { label: props.t("epochTotalVotes"), value: formatNeo(props.epochTotalVotes), variant: "accent" },
  { label: props.t("currentStrategy"), value: strategyLabel.value },
]);
</script>
