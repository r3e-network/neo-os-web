<template>
  <view class="theme-neo-swap">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Swap Tab (default) -->
      <template #content>
        <SwapTab :t="t" />
      </template>

      <!-- Pool Tab -->
      <template #tab-pool>
        <PoolTab :t="t" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import SwapTab from "./components/SwapTab.vue";
import PoolTab from "./components/PoolTab.vue";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "swap-interface",
  tabs: [
    { key: "swap", labelKey: "tabSwap", icon: "💱", default: true },
    { key: "pool", labelKey: "tabPool", icon: "💧" },
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

const activeTab = ref("swap");
const selectedPair = ref("neo-gas");

const popularPairs = [
  {
    id: "neo-gas",
    name: "NEO/GAS",
    rate: "1:45.2",
    fromIcon: "/static/neo-token.png",
    toIcon: "/static/gas-token.png",
  },
  {
    id: "gas-bneo",
    name: "GAS/bNEO",
    rate: "1:0.95",
    fromIcon: "/static/gas-token.png",
    toIcon: "/static/neo-token.png",
  },
  {
    id: "neo-flm",
    name: "NEO/FLM",
    rate: "1:125.8",
    fromIcon: "/static/neo-token.png",
    toIcon: "/static/gas-token.png",
  },
];

const appState = computed(() => ({
  selectedPair: selectedPair.value,
}));

const sidebarItems = computed(() => [
  { label: t("tabSwap"), value: selectedPair.value.toUpperCase() },
  { label: t("popularPairs"), value: popularPairs.length },
  { label: "Rate", value: popularPairs.find((p) => p.id === selectedPair.value)?.rate ?? "-" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-swap-theme.scss";

:global(page) {
  background: var(--swap-bg-start);
}

.tab-content {
  padding: 16px;

  @media (min-width: 768px) {
    padding: 0;
  }
}


.pair-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pair-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.active {
    background: rgba(0, 166, 81, 0.1);
    border-color: var(--swap-primary);
  }
}

.pair-icons {
  position: relative;

  .pair-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;

    &.overlap {
      position: absolute;
      left: 16px;
      border: 2px solid var(--swap-bg);
    }
  }
}

.pair-info {
  flex: 1;
  margin-left: 16px;
}

.pair-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--swap-text);
  display: block;
}

.pair-rate {
  font-size: 12px;
  color: var(--swap-text-secondary);
}

// Responsive styles
@media (max-width: 767px) {
  .tab-content {
    padding: 12px;
  }
  .pair-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 12px;
    padding-bottom: 8px;
  }
  .pair-item {
    min-width: 140px;
    flex-shrink: 0;
  }
}
@media (min-width: 1024px) {
  .tab-content {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
}
</style>
