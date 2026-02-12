<template>
  <view class="theme-garden-of-neo">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="flex h-full flex-col">
          <GardenTab
            :t="t"
            :contract-address="contractAddress"
            :ensure-contract-address="ensureContractAddress"
            @update:stats="updateStats"
          />
        </view>
      </template>

      <template #tab-stats>
        <StatsTab
          :t="t"
          :total-plants="stats.totalPlants"
          :ready-to-harvest="stats.readyToHarvest"
          :total-harvested="stats.totalHarvested"
        />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import GardenTab from "./components/GardenTab.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "custom",
  tabs: [
    { key: "garden", labelKey: "garden", icon: "🌱", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};
const activeTab = ref("garden");
const appState = computed(() => ({
  activeTab: activeTab.value,
  totalPlants: stats.value.totalPlants,
  readyToHarvest: stats.value.readyToHarvest,
  totalHarvested: stats.value.totalHarvested,
}));

const sidebarItems = computed(() => [
  { label: t("garden"), value: stats.value.totalPlants },
  { label: t("stats"), value: stats.value.readyToHarvest },
  { label: "Harvested", value: stats.value.totalHarvested },
]);

// Stats State
const stats = ref({
  totalPlants: 0,
  readyToHarvest: 0,
  totalHarvested: 0,
});

const updateStats = (newStats: Record<string, unknown>) => {
  stats.value = newStats;
};

// Wallet & Contract
const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap");
@import "./garden-of-neo-theme.scss";

:global(page) {
  background: var(--garden-bg);
  font-family: var(--garden-font);
}

.tab-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(180deg, var(--garden-bg) 0%, var(--garden-bg-secondary) 100%);
  min-height: 100vh;
  position: relative;
  font-family: var(--garden-font);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  /* Leaf Pattern */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 4px 4px, var(--garden-pattern) 2px, transparent 0);
    background-size: 32px 32px;
    opacity: 0.3;
    pointer-events: none;
    z-index: 0;
  }
}


/* Organic/Ethereal Overrides */
:deep(.neo-card) {
  background: var(--garden-card-bg) !important;
  border: 1px solid var(--garden-card-border) !important;
  border-radius: 20px !important;
  box-shadow: var(--garden-card-shadow) !important;
  color: var(--garden-text) !important;
  backdrop-filter: blur(12px);
  position: relative;
  overflow: hidden;

  /* Glass sheen */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--garden-sheen) 0%, transparent 100%);
    pointer-events: none;
  }

  &.variant-danger {
    border-color: var(--garden-danger-border) !important;
    background: var(--garden-danger-bg) !important;
    color: var(--garden-danger-text) !important;
  }
}

:deep(.neo-button) {
  border-radius: 12px !important;
  font-weight: 800 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s ease;

  &.variant-primary {
    background: linear-gradient(135deg, var(--garden-leaf) 0%, var(--garden-accent) 100%) !important;
    color: var(--garden-button-text) !important;
    border: none !important;
    box-shadow: var(--garden-button-shadow) !important;

    &:active {
      transform: scale(0.96);
      box-shadow: var(--garden-button-shadow-press) !important;
    }
  }
  &.variant-secondary {
    background: var(--garden-button-secondary-bg) !important;
    border: 2px solid var(--garden-button-secondary-border) !important;
    color: var(--garden-button-secondary-text) !important;

    &:hover {
      background: var(--garden-button-hover-bg) !important;
    }
  }
}

:deep(.app-layout) {
  background: var(--bg-primary);
  background-image: none;
}

// Desktop sidebar
</style>
