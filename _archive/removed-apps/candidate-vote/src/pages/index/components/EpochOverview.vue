<template>
  <StatsDisplay :items="epochStats" layout="grid" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { StatsDisplay } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const props = defineProps<{
  currentEpoch: number;
  epochEndTime: number;
  epochTotalVotes: number;
  currentStrategy: string;
}>();

const { t } = createUseI18n(messages)();

const formatNeo = (value: number) => formatNumber(value / 1e8, 2);

const toMillis = (value: number) => (value > 1_000_000_000_000 ? value : value * 1000);

const epochEndsIn = computed(() => {
  if (!props.epochEndTime) return "--";
  const diff = toMillis(props.epochEndTime) - Date.now();
  if (diff <= 0) return t("epochEnded");
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
});

const strategyLabel = computed(() => {
  if (props.currentStrategy === "self") return t("strategySelf");
  if (props.currentStrategy === "neoburger") return t("strategyNeoBurger");
  return props.currentStrategy || "--";
});

const epochStats = computed<StatsDisplayItem[]>(() => [
  { label: t("currentEpoch"), value: props.currentEpoch || "--" },
  { label: t("epochEndsIn"), value: epochEndsIn.value, variant: "warning" },
  { label: t("epochTotalVotes"), value: formatNeo(props.epochTotalVotes), variant: "accent" },
  { label: t("currentStrategy"), value: strategyLabel.value },
]);
</script>
