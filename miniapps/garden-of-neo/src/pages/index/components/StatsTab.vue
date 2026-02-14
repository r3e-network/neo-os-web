<template>
  <view class="tab-content-glass">
    <MiniAppTabStats variant="erobo-neo" :stats="statsData" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MiniAppTabStats } from "@shared/components";
import type { StatItem } from "@shared/components/NeoStats.vue";

const props = defineProps<{
  t: (key: string) => string;
  totalPlants: number;
  readyToHarvest: number;
  totalHarvested: number;
}>();

const statsData = computed<StatItem[]>(() => [
  { label: props.t("plants"), value: props.totalPlants, variant: "default" },
  { label: props.t("ready"), value: props.readyToHarvest, variant: "accent" },
  { label: props.t("harvested"), value: props.totalHarvested, variant: "success" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content-glass {
  padding: $spacing-6;
  flex: 1;
  background: transparent;
}
</style>
