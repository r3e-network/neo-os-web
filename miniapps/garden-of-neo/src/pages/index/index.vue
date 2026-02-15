<template>
  <MiniAppPage
    name="garden-of-neo"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
  >
    <template #content>
      <GardenTab
        :contract-address="contractAddress"
        :ensure-contract-address="ensureContractAddress"
        @update:stats="updateStats"
      />
    </template>

    <template #tab-stats>
      <StatsTab :row-items="statsRowItems" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('gardenActions')">
        <view class="op-hint">
          <text class="op-hint-text">{{ t("plantFee") }}</text>
        </view>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { createMiniApp } from "@shared/utils/createMiniApp";
import GardenTab from "./components/GardenTab.vue";

// Stats State
const stats = ref({
  totalPlants: 0,
  readyToHarvest: 0,
  totalHarvested: 0,
});

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "garden-of-neo",
  messages,
  template: {
    tabs: [
      { key: "garden", labelKey: "garden", icon: "🌱", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "garden", value: () => stats.value.totalPlants },
    { labelKey: "stats", value: () => stats.value.readyToHarvest },
    { labelKey: "sidebarHarvested", value: () => stats.value.totalHarvested },
  ],
});

const appState = computed(() => ({
  totalPlants: stats.value.totalPlants,
  readyToHarvest: stats.value.readyToHarvest,
  totalHarvested: stats.value.totalHarvested,
}));

const opStats = computed(() => [
  { label: t("plants"), value: stats.value.totalPlants },
  { label: t("ready"), value: stats.value.readyToHarvest, variant: "accent" as const },
  { label: t("harvested"), value: stats.value.totalHarvested },
]);

const statsRowItems = computed<StatsDisplayItem[]>(() => [
  { label: t("plants"), value: stats.value.totalPlants },
  { label: t("ready"), value: stats.value.readyToHarvest, variant: "accent" },
  { label: t("harvested"), value: stats.value.totalHarvested, variant: "success" },
]);

const updateStats = (newStats: Record<string, unknown>) => {
  stats.value = newStats;
};

// Wallet & Contract
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import "./garden-of-neo-theme.scss";

:global(page) {
  background: var(--garden-bg);
  font-family: var(--garden-font);
}

.op-hint {
  padding: 8px;
  background: var(--bg-card-subtle, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  text-align: center;
}

.op-hint-text {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}
</style>
