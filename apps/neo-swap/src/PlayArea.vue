<template>
  <div class="neo-swap-play-area">
    <SwapHero :t="t" :current-rate="currentRate" />
    <SwapTab />
    <PopularPairs :t="t" :selected-pair="selectedPair" :popular-pairs="popularPairs" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Neo Swap
 *
 * The ONLY custom component for the neo-swap miniapp. Contains the token swap
 * hero visualization, swap form, and popular pairs list. Everything else
 * (sidebar, tabs, docs, shell chrome) is rendered by the platform based on
 * manifest.ts configuration.
 */
import { computed } from "vue";
import type { Ref } from "vue";
import SwapTab from "./pages/index/components/SwapTab.vue";
import SwapHero from "./components/SwapHero.vue";
import PopularPairs from "./components/PopularPairs.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// -- State bindings -----------------------------------------------------------
const selectedPair = computed(() => String(props.state.selectedPair?.value ?? "neo-gas"));
const currentRate = computed(() => String(props.state.currentRate?.value ?? "--"));

const popularPairs = [
  { id: "neo-gas", name: "NEO/GAS", rate: "1:45.2" },
  { id: "gas-bneo", name: "GAS/bNEO", rate: "1:0.95" },
  { id: "neo-flm", name: "NEO/FLM", rate: "1:125.8" },
];
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/neo-swap-theme.scss" as *;

:global(body) {
  background: var(--swap-bg-start);
}

.neo-swap-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
