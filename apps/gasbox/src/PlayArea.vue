<template>
  <div class="gasbox-play-area">
    <GachaMachineHero
      :is-playing="isPlaying"
      :machine-name="selectedMachine?.name || t('title')"
      :machine-price="selectedMachine ? `${selectedMachine.price} ${t('tokenGas')} ${t('playLabel')}` : null"
      :machine-count-label="`${machines.length} ${t('machines')}`"
    />

    <MarketplaceTab
      :machines="machines"
      :is-loading="isLoadingMachines"
      :selected-machine="selectedMachine"
      :wallet-hash="walletHash"
      :is-playing="isPlaying"
      :show-result="showResult"
      :result-item="resultItem"
      :play-error="playError"
      @select-machine="handleSelectMachine"
      @browse-all="handleBrowseAll"
      @back="handleBack"
      @play="handlePlay"
      @close-result="handleCloseResult"
      @buy="handleBuy"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — GasBox
 *
 * The ONLY custom component for the gasbox miniapp. Contains the gacha machine
 * hero visualization and marketplace tab. Everything else (sidebar, tabs, docs,
 * shell chrome) is rendered by the platform based on manifest.ts configuration.
 *
 * Data flows in via props from defineMiniApp's render function.
 * Actions are dispatched via the injected action registry.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import GachaMachineHero from "./components/GachaMachineHero.vue";
import MarketplaceTab from "./components/MarketplaceTab.vue";
import type { Machine, MachineItem } from "./types";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

// -- State bindings -----------------------------------------------------------
const machines = computed(() => (props.state.machines?.value ?? []) as Machine[]);
const selectedMachine = computed(() => (props.state.selectedMachine?.value ?? null) as Machine | null);
const isLoadingMachines = computed(() => Boolean(props.state.isLoadingMachines?.value ?? false));
const walletHash = computed(() => String(props.state.walletHash?.value ?? ""));
const isPlaying = computed(() => Boolean(props.state.isPlaying?.value ?? false));
const showResult = computed(() => Boolean(props.state.showResult?.value ?? false));
const resultItem = computed(() => (props.state.resultItem?.value ?? null) as MachineItem | null);
const playError = computed(() => (props.state.playError?.value ?? null) as string | null);

// -- Action dispatch ----------------------------------------------------------
const handleSelectMachine = (machine: Machine) => {
  actions.get("selectMachine")?.(machine);
};

const handleBrowseAll = () => {
  actions.get("browseAll")?.();
};

const handleBack = () => {
  actions.get("deselectMachine")?.();
};

const handlePlay = async () => {
  await actions.get("play")?.();
};

const handleCloseResult = () => {
  actions.get("closeResult")?.();
};

const handleBuy = async () => {
  await actions.get("buy")?.();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./pages/index/gasbox-theme.scss" as *;
@import url("https://fonts.googleapis.com/css2?family=Righteous&display=swap");

@include page-background(var(--gacha-bg));

.gasbox-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  position: relative;
  overflow: hidden;
  font-family: "Righteous", cursive;

  &::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: conic-gradient(
      from 0deg at 50% 50%,
      transparent 0deg,
      rgba(124, 58, 237, 0.06) 60deg,
      transparent 120deg,
      rgba(245, 158, 11, 0.06) 180deg,
      transparent 240deg,
      rgba(124, 58, 237, 0.06) 300deg,
      transparent 360deg
    );
    animation: mysterybox-rotate 20s linear infinite;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 20% 20%,
        rgba(124, 58, 237, 0.08) 0%,
        transparent 40%
      ),
      radial-gradient(circle at 80% 60%, rgba(245, 158, 11, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 50% 90%, rgba(124, 58, 237, 0.06) 0%, transparent 30%);
    pointer-events: none;
  }
}

@keyframes mysterybox-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

:deep(.gacha-machine-hero),
:deep(.marketplace-tab) {
  position: relative;
  z-index: 1;
}

/* Sparkle effect on headings */
:deep(h1),
:deep(h2),
:deep(h3),
:deep(.hero-title) {
  font-family: "Righteous", cursive;
  background: linear-gradient(
    135deg,
    #c084fc 0%,
    #f59e0b 25%,
    #e879f9 50%,
    #f59e0b 75%,
    #c084fc 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer-text 4s ease-in-out infinite;
}

@keyframes shimmer-text {
  0%,
  100% {
    background-position: 0% center;
  }
  50% {
    background-position: 200% center;
  }
}

/* Rarity badge color coding */
:deep(.rarity-common) {
  color: #9ca3af;
  border-color: rgba(156, 163, 175, 0.3);
}

:deep(.rarity-rare) {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
}

:deep(.rarity-epic) {
  color: #c084fc;
  border-color: rgba(192, 132, 252, 0.3);
  text-shadow: 0 0 12px rgba(192, 132, 252, 0.5);
}

:deep(.rarity-legendary) {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.4);
  text-shadow: 0 0 15px rgba(251, 191, 36, 0.6);
  animation: legendary-glow 2s ease-in-out infinite;
}

@keyframes legendary-glow {
  0%,
  100% {
    text-shadow: 0 0 15px rgba(251, 191, 36, 0.6);
  }
  50% {
    text-shadow: 0 0 25px rgba(251, 191, 36, 0.9), 0 0 40px rgba(251, 191, 36, 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gasbox-play-area::before {
    animation: none;
  }
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(.hero-title) {
    animation: none;
    background-position: 0% center;
  }
  :deep(.rarity-legendary) {
    animation: none;
  }
}
</style>
