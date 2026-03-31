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
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

:global(body) {
  background: var(--swap-bg-start);
}

.neo-swap-play-area {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'IBM Plex Sans', 'Inter', sans-serif;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 48px,
        var(--swap-grid-line, rgba(0, 255, 136, 0.03)) 48px,
        var(--swap-grid-line, rgba(0, 255, 136, 0.03)) 49px
      );
    pointer-events: none;
    z-index: 0;
    opacity: 0.6;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

:deep(.neo-card) {
  font-family: 'IBM Plex Sans', 'Inter', sans-serif;
  background: var(--swap-card-bg, rgba(13, 17, 23, 0.8));
  border: 1px solid var(--swap-card-border, rgba(0, 255, 136, 0.2));
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.25),
      0 0 0 1px var(--swap-card-glow, rgba(0, 255, 136, 0.1));
  }
}

:deep(.neo-btn--primary) {
  font-family: 'IBM Plex Sans', 'Inter', sans-serif;
  background: var(--swap-action-gradient, linear-gradient(135deg, #00ff88 0%, #00d4aa 50%, #00a8ff 100%));
  color: var(--swap-action-text, #000);
  font-weight: 600;
  border: none;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.25);
  letter-spacing: 0.02em;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 8px 28px rgba(16, 185, 129, 0.35);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: 'IBM Plex Sans', 'Inter', sans-serif;
  background: var(--swap-chip-bg, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--swap-chip-border, rgba(255, 255, 255, 0.1));
  color: var(--swap-text-muted, rgba(255, 255, 255, 0.5));
  border-radius: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;

  &:hover {
    background: var(--swap-chip-hover-bg, rgba(0, 255, 136, 0.1));
    border-color: var(--swap-chip-hover-border, rgba(0, 255, 136, 0.3));
    color: var(--swap-accent, #00ff88);
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
