<template>
  <view class="theme-garden-of-neo">
    <MiniAppShell :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event" :sidebar-items="sidebarItems" :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
      <template #content>
        
          <GardenTab
            :t="t"
            :contract-address="contractAddress"
            :ensure-contract-address="ensureContractAddress"
            @update:stats="updateStats"
          />
        
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
        <MiniAppOperationStats variant="erobo" :title="t('gardenActions')" :stats="opStats">
          <view class="op-hint">
            <text class="op-hint-text">{{ t("plantFee") }}</text>
          </view>
        </MiniAppOperationStats>
      </template>
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell, MiniAppOperationStats } from "@shared/components";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createPrimaryStatsTemplateConfig, createSidebarItems } from "@shared/utils";
import GardenTab from "./components/GardenTab.vue";
import StatsTab from "./components/StatsTab.vue";

const { t } = createUseI18n(messages)();

const templateConfig = createPrimaryStatsTemplateConfig(
  { key: "garden", labelKey: "garden", icon: "🌱", default: true },
  { docFeatureCount: 3 },
);
const activeTab = ref("garden");
const appState = computed(() => ({
  activeTab: activeTab.value,
  totalPlants: stats.value.totalPlants,
  readyToHarvest: stats.value.readyToHarvest,
  totalHarvested: stats.value.totalHarvested,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "garden", value: () => stats.value.totalPlants },
  { labelKey: "stats", value: () => stats.value.readyToHarvest },
  { labelKey: "sidebarHarvested", value: () => stats.value.totalHarvested },
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
