<template>
  <NeoCard :variant="variant" :title="title">
    <NeoStats v-if="showStats && statsPosition === 'top'" :stats="stats" />
    <slot />
    <NeoStats v-if="showStats && statsPosition === 'bottom'" :stats="stats" />
  </NeoCard>
</template>

<script setup lang="ts">
import NeoCard from "./NeoCard.vue";
import NeoStats, { type StatItem } from "./NeoStats.vue";
import type { CardVariant } from "./NeoCard.vue";

type StatsPosition = "top" | "bottom";

withDefaults(
  defineProps<{
    stats: StatItem[];
    title?: string;
    variant?: CardVariant;
    showStats?: boolean;
    statsPosition?: StatsPosition;
  }>(),
  {
    title: undefined,
    variant: "erobo",
    showStats: true,
    statsPosition: "top",
  }
);
</script>
