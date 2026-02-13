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
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('mainnet')">
          <NetworkStats :mainnet-stats="mainnetStats" :testnet-stats="testnetStats" :t="t" />
        </NeoCard>
      </template>

      <template #tab-history>
        <RecentTransactions :transactions="recentTxs" :t="t" @viewTx="viewTx" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoCard, SidebarPanel, ErrorBoundary } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import NetworkStats from "./components/NetworkStats.vue";
import SearchPanel from "./components/SearchPanel.vue";
import SearchResult from "./components/SearchResult.vue";
import RecentTransactions from "./components/RecentTransactions.vue";
import { useExplorerData } from "@/composables/useExplorerData";

const { t } = createUseI18n(messages)();

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
  contentType: "two-column",
  tabs: [
    { key: "search", labelKey: "tabSearch", icon: "🔍", default: true },
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

const { handleBoundaryError } = useHandleBoundaryError("explorer");
const resetAndReload = async () => {
  await search();
};

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
@use "@shared/styles/page-common" as *;
@import "./explorer-theme.scss";

@include page-background(
  var(--matrix-bg),
  (
    font-family: var(--matrix-font),
  )
);

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
</style>
