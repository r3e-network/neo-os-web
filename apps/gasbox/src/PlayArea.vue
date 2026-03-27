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

@include page-background(var(--gacha-bg));

.gasbox-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
