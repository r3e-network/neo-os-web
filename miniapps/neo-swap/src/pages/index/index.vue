<template>
  <view class="theme-neo-swap">
    <MiniAppShell
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
      :sidebar-items="sidebarItems"
      :sidebar-title="t('overview')"
      :fallback-message="t('errorFallback')"
      :on-boundary-error="handleBoundaryError"
      :on-boundary-retry="resetAndReload">
<!-- Swap Tab (default) - LEFT panel -->
      <template #content>
        
          <SwapTab :t="t" />
        
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
    </MiniAppShell>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppShell, NeoCard } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import SwapTab from "./components/SwapTab.vue";
import PoolTab from "./components/PoolTab.vue";

const { t } = createUseI18n(messages)();
const { status } = useStatusMessage();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "swap", labelKey: "tabSwap", icon: "💱", default: true },
    { key: "pool", labelKey: "tabPool", icon: "💧" },
  ],
  docFeatureCount: 3,
});

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

const sidebarItems = createSidebarItems(t, [
  { labelKey: "tabSwap", value: () => selectedPair.value.toUpperCase() },
  { labelKey: "popularPairs", value: () => popularPairs.length },
  { labelKey: "sidebarRate", value: () => popularPairs.find((p) => p.id === selectedPair.value)?.rate ?? "-" },
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
