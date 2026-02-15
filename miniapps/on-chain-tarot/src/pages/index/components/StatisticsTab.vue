<template>
  <NeoCard variant="erobo" class="mystical-card">
    <StatsDisplay :items="statsItems" layout="rows" />
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, StatsDisplay } from "@shared/components";

const props = defineProps<{
  readingsCount: number;
  t: (key: string, ...args: unknown[]) => string;
}>();

const statsItems = computed<StatsDisplayItem[]>(() => [
  { label: props.t("totalGames"), value: props.readingsCount },
  { label: props.t("cardsDrawnCount"), value: props.readingsCount * 3 },
  { label: props.t("totalSpent"), value: `${(props.readingsCount * 0.05).toFixed(2)} GAS` },
]);
</script>
