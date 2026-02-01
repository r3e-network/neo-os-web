<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-explorer" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <view class="app-container">
      <!-- Network Tab -->
      <view v-if="activeTab === 'network'" class="tab-content">
        <NetworkStats :mainnet-stats="mainnetStats" :testnet-stats="testnetStats" :t="t as any" />
      </view>

      <!-- Chain Warning - Framework Component -->
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

      <!-- Status Message -->
      <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
        <text class="status-text">{{ status.msg }}</text>
      </NeoCard>

      <!-- Search Tab -->
      <view v-if="activeTab === 'search'" class="tab-content">
        <SearchPanel
          v-model:searchQuery="searchQuery"
          v-model:selectedNetwork="selectedNetwork"
          :is-loading="isLoading"
          :t="t as any"
          @search="search"
        />

        <view v-if="isLoading" class="loading">
          <text>{{ t("searching") }}</text>
        </view>

        <SearchResult :result="searchResult" :t="t as any" @viewTx="viewTx" />
      </view>

      <!-- History Tab -->
      <view v-if="activeTab === 'history'" class="tab-content">
        <RecentTransactions :transactions="recentTxs" :t="t as any" @viewTx="viewTx" />
      </view>
    </view>

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

// Responsive state
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);
const handleResize = () => { windowWidth.value = window.innerWidth; };
import { formatNumber } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { ResponsiveLayout, NeoDoc, NeoCard, NeoButton, ChainWarning } from "@shared/components";
import type { NavTab } from "@shared/components/NavBar.vue";
import type { StatItem } from "@shared/components/NeoStats.vue";

import NetworkStats from "./components/NetworkStats.vue";
import SearchPanel from "./components/SearchPanel.vue";
import SearchResult from "./components/SearchResult.vue";
import RecentTransactions from "./components/RecentTransactions.vue";

const { t } = useI18n();

// Detect host URL for API calls (miniapp runs in iframe)
const getApiBase = () => {
  try {
    if (window.parent !== window) {
      // Running in iframe, use parent origin
      const parentOrigin = document.referrer ? new URL(document.referrer).origin : "";
      if (parentOrigin) return `${parentOrigin}/api/explorer`;
    }
  } catch {
    // Fallback
  }
  return "/api/explorer";
};
const API_BASE = getApiBase();

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

const activeTab = ref("search");
const navTabs = computed<NavTab[]>(() => [
  { id: "search", icon: "search", label: t("tabSearch") },
  { id: "network", icon: "activity", label: t("mainnet") },
  { id: "history", icon: "clock", label: t("tabHistory") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const { chainType } = useWallet() as WalletSDK;

const searchQuery = ref("");
const selectedNetwork = ref<"mainnet" | "testnet">("mainnet");
const isLoading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
const searchResult = ref<any>(null);
const recentTxs = ref<any[]>([]);

const stats = ref({
  mainnet: { height: 0, txCount: 0 },
  testnet: { height: 0, txCount: 0 },
});

// Timer tracking for cleanup
let statsInterval: ReturnType<typeof setInterval> | null = null;

const formatNum = (n: number) => formatNumber(n, 0);

const mainnetStats = computed<StatItem[]>(() => [
  { label: t("blockHeight"), value: formatNum(stats.value.mainnet.height), variant: "default" },
  { label: t("transactions"), value: formatNum(stats.value.mainnet.txCount), variant: "default" },
]);

const testnetStats = computed<StatItem[]>(() => [
  { label: t("blockHeight"), value: formatNum(stats.value.testnet.height), variant: "default" },
  { label: t("transactions"), value: formatNum(stats.value.testnet.txCount), variant: "default" },
]);

const STATS_CACHE_KEY = "explorer_stats_cache";
const TXS_CACHE_KEY = "explorer_txs_cache";

// Fetch stats via SDK datafeed service
const fetchStats = async () => {
  // Try cache first
  try {
    const cached = uni.getStorageSync(STATS_CACHE_KEY);
    if (cached) stats.value = JSON.parse(cached);
  } catch {}

  let freshStats = null;

  try {
    const res = await uni.request({
      url: `${API_BASE}/stats`,
      method: "GET",
    });
    if (res.statusCode === 200 && res.data) {
      freshStats = res.data as any;
    }
  } catch {
    // Ignore and fall back to cached stats.
  }

  if (freshStats) {
    stats.value = freshStats;
    uni.setStorageSync(STATS_CACHE_KEY, JSON.stringify(freshStats));
  }
};

// Fetch recent transactions via SDK datafeed service
const fetchRecentTxs = async () => {
  // Try cache first
  try {
    const cached = uni.getStorageSync(TXS_CACHE_KEY);
    if (cached) recentTxs.value = JSON.parse(cached);
  } catch {}

  let freshTxs = null;

  try {
    const res = await uni.request({
      url: `${API_BASE}/recent?network=${selectedNetwork.value}&limit=10`,
      method: "GET",
    });
    if (res.statusCode === 200 && res.data) {
      freshTxs = (res.data as any).transactions || [];
    }
  } catch {
    // Ignore and fall back to cached txs.
  }

  if (freshTxs) {
    recentTxs.value = freshTxs;
    uni.setStorageSync(TXS_CACHE_KEY, JSON.stringify(freshTxs));
  }
};

const search = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    status.value = { msg: t("pleaseEnterQuery"), type: "error" };
    return;
  }

  isLoading.value = true;
  searchResult.value = null;
  status.value = null;

  try {
    const res = await uni.request({
      url: `${API_BASE}/search?q=${encodeURIComponent(query)}&network=${selectedNetwork.value}`,
      method: "GET",
    });

    if (res.statusCode === 200 && res.data) {
      searchResult.value = res.data;
    } else {
      status.value = { msg: t("noResults"), type: "error" };
    }
  } catch (e: any) {
    status.value = { msg: t("searchFailed"), type: "error" };
  } finally {
    isLoading.value = false;
  }
};

const viewTx = (hash: string) => {
  searchQuery.value = hash;
  activeTab.value = "search";
  search();
};

onMounted(() => {
  fetchStats();
  fetchRecentTxs();
  statsInterval = setInterval(fetchStats, 15000);
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

watch(selectedNetwork, () => {
  fetchRecentTxs();
});

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
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

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
