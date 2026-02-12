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
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>

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
      </template>

      <template #tab-stats>
        <NeoCard variant="erobo" class="mb-4">
          <view class="stats-grid">
            <NeoCard flat variant="erobo-neo" class="flex flex-col items-center p-3 text-center">
              <text class="stat-value">{{ ownedTiles }}</text>
              <text class="stat-label">{{ t("tilesOwned") }}</text>
            </NeoCard>
            <NeoCard flat variant="erobo-neo" class="flex flex-col items-center p-3 text-center">
              <text class="stat-value">{{ coverage }}%</text>
              <text class="stat-label">{{ t("mapControl") }}</text>
            </NeoCard>
            <NeoCard flat variant="erobo-neo" class="flex flex-col items-center p-3 text-center">
              <text class="stat-value">{{ formatNum(totalSpent) }}</text>
              <text class="stat-label">{{ t("gasSpent") }}</text>
            </NeoCard>
          </view>
        </NeoCard>

        <NeoCard variant="erobo">
          <NeoStats :stats="statsData" />
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, NeoStats, SidebarPanel, type StatItem } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useMapTiles } from "@/composables/useMapTiles";
import { useMapInteractions } from "@/composables/useMapInteractions";
import MapGrid from "./components/MapGrid.vue";
import PurchasePanel from "./components/PurchasePanel.vue";

const { t } = useI18n();
const { address } = useWallet() as WalletSDK;

const templateConfig: MiniAppTemplateConfig = {
  contentType: "custom",
  tabs: [
    { key: "map", labelKey: "map", icon: "🗺️", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: true,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};
const activeTab = ref("map");
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

const sidebarItems = computed(() => [
  { label: t("tilesOwned"), value: ownedTiles.value },
  { label: t("mapControl"), value: `${coverage.value}%` },
  { label: t("gasSpent"), value: `${formatNum(totalSpent.value)} GAS` },
  { label: "Tile Price", value: `${TILE_PRICE} GAS` },
]);

const statsData = computed<StatItem[]>(() => [
  { label: t("owned"), value: ownedTiles.value, variant: "accent" },
  { label: t("spent"), value: `${formatNum(totalSpent.value)} GAS`, variant: "default" },
  { label: t("coverage"), value: `${coverage.value}%`, variant: "success" },
]);

watch(address, async () => {
  await loadTiles();
}, { immediate: true });
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./million-piece-map-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.tab-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background-color: var(--map-sea);
  background-image:
    repeating-linear-gradient(45deg, transparent 0, transparent 40px, var(--map-grid) 40px, var(--map-grid) 80px),
    radial-gradient(var(--map-paper) 20%, transparent 20%);
  background-size:
    200px 200px,
    40px 40px;
  min-height: 100vh;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--map-gold);
  font-family: $font-mono;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-top: 4px;
}

:global(.theme-million-piece) :deep(.neo-card) {
  background: var(--map-bg) !important;
  color: var(--map-ink) !important;
  border: 2px solid var(--map-border) !important;
  box-shadow: var(--map-card-shadow-lite) !important;
  border-radius: 4px !important;

  &.variant-erobo-neo {
    background: var(--map-paper) !important;
  }
  &.variant-danger {
    background: var(--map-danger-bg) !important;
    border-color: var(--map-red) !important;
    color: var(--map-red) !important;
  }
}

@media (max-width: 767px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .tab-content {
    padding: 16px;
  }
}
</style>
