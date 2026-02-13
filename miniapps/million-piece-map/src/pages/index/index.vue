<template>
  <view class="theme-million-piece">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="status?.type === 'success'"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <MapGrid
            :tiles="tiles"
            :selected-x="selectedX"
            :selected-y="selectedY"
            :zoom-level="zoomLevel"
            :get-tile-color="getTileColor"
            :t="t"
            @select-tile="selectTile"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <PurchasePanel
          :selected-tile="selectedTile"
          :selected-x="selectedX"
          :selected-y="selectedY"
          :is-owned="tiles[selectedTile]?.owned || false"
          :tile-price="TILE_PRICE"
          :is-purchasing="isPurchasing"
          :t="t"
          @purchase="purchaseTile"
        />
        <NeoStats :stats="mapStats" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { useMapTiles } from "@/composables/useMapTiles";
import { useMapInteractions } from "@/composables/useMapInteractions";
import MapGrid from "./components/MapGrid.vue";
import PurchasePanel from "./components/PurchasePanel.vue";

const { t } = createUseI18n(messages)();
const { address } = useWallet() as WalletSDK;

const templateConfig = createTemplateConfig({
  tabs: [{ key: "main", labelKey: "map", icon: "🗺️", default: true }],
  fireworks: true,
});
const activeTab = ref("main");
const appState = computed(() => ({
  ownedTiles: ownedTiles.value,
  coverage: coverage.value,
  totalSpent: totalSpent.value,
}));

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

const sidebarItems = createSidebarItems(t, [
  { labelKey: "tilesOwned", value: () => ownedTiles.value },
  { labelKey: "mapControl", value: () => `${coverage.value}%` },
  { labelKey: "gasSpent", value: () => `${formatNum(totalSpent.value)} GAS` },
  { labelKey: "sidebarTilePrice", value: () => `${TILE_PRICE} GAS` },
]);

const mapStats = computed(() => [
  { label: t("tilesOwned"), value: ownedTiles.value },
  { label: t("mapControl"), value: `${coverage.value}%` },
  { label: t("gasSpent"), value: `${formatNum(totalSpent.value)} GAS` },
]);

watch(
  address,
  async () => {
    await loadTiles();
  },
  { immediate: true }
);

const { handleBoundaryError } = useHandleBoundaryError("million-piece-map");
const resetAndReload = async () => {
  await loadTiles();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./million-piece-map-theme.scss";

:global(page) {
  background: var(--bg-primary);
}
</style>
