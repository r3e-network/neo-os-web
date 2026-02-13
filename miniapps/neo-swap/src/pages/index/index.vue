<template>
  <view class="theme-neo-swap">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- Swap Tab (default) - LEFT panel -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <SwapTab :t="t" />
        </ErrorBoundary>
      </template>

      <!-- RIGHT panel: Popular Pairs -->
      <template #operation>
        <NeoCard variant="erobo" :title="t('popularPairs')">
          <view class="pair-list">
            <view
              v-for="pair in popularPairs"
              :key="pair.id"
              class="pair-item"
              :class="{ active: selectedPair === pair.id }"
              @click="selectedPair = pair.id"
            >
              <view class="pair-info">
                <text class="pair-name">{{ pair.name }}</text>
                <text class="pair-rate">{{ pair.rate }}</text>
              </view>
            </view>
          </view>
        </NeoCard>
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
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import SwapTab from "./components/SwapTab.vue";
import PoolTab from "./components/PoolTab.vue";

const { t } = createUseI18n(messages)();
const { status } = useStatusMessage();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
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
  { id: "neo-gas", name: "NEO/GAS", rate: "1:45.2" },
  { id: "gas-bneo", name: "GAS/bNEO", rate: "1:0.95" },
  { id: "neo-flm", name: "NEO/FLM", rate: "1:125.8" },
];

const appState = computed(() => ({
  selectedPair: selectedPair.value,
}));

const sidebarItems = computed(() => [
  { label: t("tabSwap"), value: selectedPair.value.toUpperCase() },
  { label: t("popularPairs"), value: popularPairs.length },
  { label: t("sidebarRate"), value: popularPairs.find((p) => p.id === selectedPair.value)?.rate ?? "-" },
]);

const { handleBoundaryError, resetAndReload } = useHandleBoundaryError("neo-swap");
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-swap-theme.scss";

:global(page) {
  background: var(--swap-bg-start);
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
  background: var(--bg-card-hover, rgba(255, 255, 255, 0.03));
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--border-subtle, rgba(255, 255, 255, 0.08));
  }

  &.active {
    background: var(--accent-bg, rgba(0, 166, 81, 0.1));
    border-color: var(--swap-primary);
  }
}

.pair-info {
  flex: 1;
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
</style>
