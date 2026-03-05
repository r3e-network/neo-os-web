<template>
  <MiniAppPage
    name="million-piece-map"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadTiles"
  >
    <template #content>
      <MapGrid
        :tiles="tiles"
        :selected-x="selectedX"
        :selected-y="selectedY"
        :zoom-level="zoomLevel"
        :get-tile-color="getTileColor"
        @select-tile="selectTile"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
      />
    </template>

    <template #operation>
      <PurchasePanel
        :selected-tile="selectedTile"
        :selected-x="selectedX"
        :selected-y="selectedY"
        :is-owned="tiles[selectedTile]?.owned || false"
        :tile-price="TILE_PRICE"
        :is-purchasing="isPurchasing"
        @purchase="purchaseTile"
      />
      <NeoCard variant="erobo-neo">
        <StatsDisplay :items="mapStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useMapTiles } from "@/composables/useMapTiles";
import { useMapInteractions } from "@/composables/useMapInteractions";
import MapGrid from "./components/MapGrid.vue";

const { address } = useWallet() as WalletSDK;

const {
  tiles,
  selectedTile,
  selectedX,
  selectedY,
  ownedTiles,
  totalSpent,
  coverage,
  formatNum,
  getTileColor,
  selectTile,
  loadTiles,
  ensureContractAddress,
  TILE_PRICE,
} = useMapTiles();

const { isPurchasing, zoomLevel, status, zoomIn, zoomOut, purchaseTile } = useMapInteractions(
  tiles,
  selectedTile,
  ensureContractAddress,
  loadTiles
);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "million-piece-map",
  messages,
  template: {
    tabs: [{ key: "main", labelKey: "map", icon: "🗺️", default: true }],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "tilesOwned", value: () => ownedTiles.value },
    { labelKey: "mapControl", value: () => `${coverage.value}%` },
    { labelKey: "gasSpent", value: () => `${formatNum(totalSpent.value)} GAS` },
    { labelKey: "sidebarTilePrice", value: () => `${TILE_PRICE} GAS` },
  ],
});

const appState = computed(() => ({
  ownedTiles: ownedTiles.value,
  coverage: coverage.value,
  totalSpent: totalSpent.value,
}));
watch(
  address,
  async () => {
    await loadTiles();
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./million-piece-map-theme.scss";

:global(page) {
  background: var(--bg-primary);
}
</style>
