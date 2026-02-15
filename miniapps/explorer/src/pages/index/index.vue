<template>
  <MiniAppPage
    name="explorer"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="search"
    @tab-change="activeTab = $event"
  >
    <template #content>
      <SearchPanel
        v-model:searchQuery="searchQuery"
        v-model:selectedNetwork="selectedNetwork"
        :is-loading="isLoading"
        :t="t"
        @search="search"
      />

      <view v-if="isLoading" class="loading" role="status" aria-live="polite">
        <text>{{ t("searching") }}</text>
      </view>

      <SearchResult :result="searchResult" :t="t" @viewTx="viewTx" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('mainnet')">
        <view class="stats-grid-gap">
          <StatsDisplay :items="mainnetStats" layout="grid" />
          <StatsDisplay :items="testnetStats" layout="grid" />
        </view>
      </NeoCard>
    </template>

    <template #tab-history>
      <RecentTransactions :transactions="recentTxs" :t="t" @viewTx="viewTx" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import SearchPanel from "./components/SearchPanel.vue";
import SearchResult from "./components/SearchResult.vue";
import { useExplorerData } from "@/composables/useExplorerData";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "explorer",
  messages,
  template: {
    tabs: [
      { key: "search", labelKey: "tabSearch", icon: "🔍", default: true },
      { key: "history", labelKey: "tabHistory", icon: "🕐" },
    ],
  },
});

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

.stats-grid-gap {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
