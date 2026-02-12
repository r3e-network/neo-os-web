<template>
  <view class="theme-explorer">
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

      <template #content>
        <view class="app-container">
          <!-- Status Message -->
          <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
            <text class="status-text">{{ status.msg }}</text>
          </NeoCard>

          <SearchPanel
            v-model:searchQuery="searchQuery"
            v-model:selectedNetwork="selectedNetwork"
            :is-loading="isLoading"
            :t="t"
            @search="search"
          />

          <view v-if="isLoading" class="loading">
            <text>{{ t("searching") }}</text>
          </view>

          <SearchResult :result="searchResult" :t="t" @viewTx="viewTx" />
        </view>
      </template>

      <template #tab-network>
        <view class="app-container">
          <NetworkStats :mainnet-stats="mainnetStats" :testnet-stats="testnetStats" :t="t" />
        </view>
      </template>

      <template #tab-history>
        <view class="app-container">
          <RecentTransactions :transactions="recentTxs" :t="t" @viewTx="viewTx" />
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import NetworkStats from "./components/NetworkStats.vue";
import SearchPanel from "./components/SearchPanel.vue";
import SearchResult from "./components/SearchResult.vue";
import RecentTransactions from "./components/RecentTransactions.vue";
import { useExplorerData } from "@/composables/useExplorerData";

const { t } = useI18n();

const {
  searchQuery,
  selectedNetwork,
  isLoading,
  status,
  searchResult,
  recentTxs,
  mainnetStats,
  testnetStats,
  sidebarItems,
  search,
  startPolling,
  stopPolling,
  watchNetwork,
} = useExplorerData(t);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "dashboard",
  tabs: [
    { key: "search", labelKey: "tabSearch", icon: "🔍", default: true },
    { key: "network", labelKey: "mainnet", icon: "📡" },
    { key: "history", labelKey: "tabHistory", icon: "🕐" },
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
      ],
    },
  },
};

const activeTab = ref("search");
const appState = computed(() => ({
  activeTab: activeTab.value,
  isLoading: isLoading.value,
  selectedNetwork: selectedNetwork.value,
  searchResult: searchResult.value,
}));

const viewTx = (hash: string) => {
  searchQuery.value = hash;
  activeTab.value = "search";
  search();
};

onMounted(() => {
  startPolling();
  watchNetwork();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./explorer-theme.scss";

:global(page) {
  background: var(--matrix-bg);
  font-family: var(--matrix-font);
}

.app-container {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--matrix-bg);
  color: var(--matrix-green);
  min-height: 100vh;
  /* Scanlines */
  background-image: var(--matrix-scanlines), var(--matrix-glitch);
  background-size:
    100% 2px,
    3px 100%;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Matrix Component Overrides */
:deep(.neo-card) {
  background: var(--matrix-bg) !important;
  border: 1px solid var(--matrix-green) !important;
  border-radius: 0 !important;
  box-shadow: var(--matrix-card-shadow) !important;
  color: var(--matrix-green) !important;

  &.variant-danger {
    border-color: var(--matrix-danger) !important;
    color: var(--matrix-danger) !important;
    box-shadow: var(--matrix-danger-glow) !important;
  }
}

:deep(.neo-button) {
  background: var(--matrix-bg) !important;
  border: 1px solid var(--matrix-green) !important;
  color: var(--matrix-green) !important;
  border-radius: 0 !important;
  text-transform: uppercase;
  font-family: var(--matrix-font);

  &:active {
    background: var(--matrix-green) !important;
    color: var(--matrix-bg) !important;
  }
}

:deep(input),
:deep(.neo-input) {
  background: var(--matrix-input-bg) !important;
  border: 1px solid var(--matrix-green) !important;
  color: var(--matrix-green) !important;
  font-family: var(--matrix-font) !important;
  border-radius: 0 !important;
}

:deep(text),
:deep(view) {
  font-family: var(--matrix-font) !important;
}

.status-text {
  font-family: var(--matrix-font);
  font-size: 14px;
  font-weight: bold;
  color: var(--matrix-green);
  text-align: center;
  text-shadow: var(--matrix-text-glow);
}

.loading {
  text-align: center;
  padding: 20px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}


/* Mobile-specific styles */
@media (max-width: 767px) {
  .app-container {
    padding: 12px;
    gap: 12px;
  }
  .tab-content {
    gap: 12px;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .app-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .tab-content {
    gap: 20px;
  }
}

// Desktop sidebar
</style>
