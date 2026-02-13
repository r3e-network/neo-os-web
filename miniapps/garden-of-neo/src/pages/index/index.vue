<template>
  <view class="theme-garden-of-neo">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <GardenTab
            :t="t"
            :contract-address="contractAddress"
            :ensure-contract-address="ensureContractAddress"
            @update:stats="updateStats"
          />
        </ErrorBoundary>
      </template>

      <template #tab-stats>
        <StatsTab
          :t="t"
          :total-plants="stats.totalPlants"
          :ready-to-harvest="stats.readyToHarvest"
          :total-harvested="stats.totalHarvested"
        />
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('gardenActions')">
          <NeoStats :stats="opStats" />
          <view class="op-hint">
            <text class="op-hint-text">{{ t("plantFee") }}</text>
          </view>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import GardenTab from "./components/GardenTab.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = createUseI18n(messages)();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
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
  { label: t("sidebarHarvested"), value: stats.value.totalHarvested },
]);

const opStats = computed(() => [
  { label: t("plants"), value: stats.value.totalPlants },
  { label: t("ready"), value: stats.value.readyToHarvest, variant: "accent" as const },
  { label: t("harvested"), value: stats.value.totalHarvested },
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

const { handleBoundaryError, resetAndReload } = useHandleBoundaryError("garden-of-neo");

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
