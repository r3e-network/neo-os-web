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
      <div class="hero-container">
        <HeroSection variant="erobo-neo" compact>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-label">{{ t("tabSearch") }}</span>
                <span class="hero-stat-value">{{ mainnetStats?.[0]?.value ?? "—" }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-label">{{ t("tabHistory") }}</span>
                <span class="hero-stat-value">{{ recentTxs.length }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <SearchPanel
        v-model:searchQuery="searchQuery"
        v-model:selectedNetwork="selectedNetwork"
        :is-loading="isLoading"
        :t="t"
        @search="search"
      />

      <div v-if="isLoading" class="loading" role="status" aria-live="polite">
        <span>{{ t("searching") }}</span>
      </div>

      <SearchResult :result="searchResult" :t="t" @viewTx="viewTx" />
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('mainnet')">
        <div class="stats-grid-gap">
          <StatsDisplay :items="mainnetStats" layout="grid" />
          <StatsDisplay :items="testnetStats" layout="grid" />
        </div>
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
import { MiniAppPage, HeroSection } from "@shared/components";
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
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./explorer-theme.scss" as *;

@include page-background(
  var(--matrix-bg),
  (
    font-family: var(--matrix-font),
  )
);

.hero-container {
  margin-bottom: 20px;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--matrix-font, monospace);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

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

/* ── Explorer Hero Enhancements ── */
@keyframes explorer-scan-line {
  0% {
    top: 0;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

@keyframes explorer-hash-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes explorer-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(0, 255, 65, 0.1);
  }
  50% {
    box-shadow:
      0 0 28px rgba(0, 255, 65, 0.25),
      0 0 56px rgba(0, 255, 65, 0.08);
  }
}

.hero-container {
  background: linear-gradient(180deg, rgba(0, 255, 65, 0.08), rgba(0, 200, 50, 0.03), transparent);
  box-shadow:
    0 0 30px rgba(0, 255, 65, 0.06),
    inset 0 1px 0 rgba(0, 255, 65, 0.1);
  border: 1px solid rgba(0, 255, 65, 0.08);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  padding: 20px;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(0, 255, 65, 0.6), transparent);
    animation: explorer-scan-line 4s linear infinite;
    z-index: 1;
    pointer-events: none;
  }
}

.hero-stat {
  animation: explorer-pulse 3s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(0, 255, 65, 0.1), rgba(0, 200, 50, 0.04));
}

.hero-stat-value {
  background: linear-gradient(90deg, var(--text-primary) 40%, rgba(0, 255, 65, 0.8) 50%, var(--text-primary) 60%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: explorer-hash-shimmer 5s linear infinite;
}

</style>
