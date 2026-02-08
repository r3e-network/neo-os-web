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
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
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
            :t="t as any"
            @search="search"
          />

          <view v-if="isLoading" class="loading">
            <text>{{ t("searching") }}</text>
          </view>

          <SearchResult :result="searchResult" :t="t as any" @viewTx="viewTx" />
        </view>
      </template>

      <template #tab-network>
        <view class="app-container">
          <NetworkStats :mainnet-stats="mainnetStats" :testnet-stats="testnetStats" :t="t as any" />
        </view>
      </template>

      <template #tab-history>
        <view class="app-container">
          <RecentTransactions :transactions="recentTxs" :t="t as any" @viewTx="viewTx" />
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

// Responsive state
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};
import { formatNumber } from "@shared/utils/format";
import { useI18n } from "@/composables/useI18n";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
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
const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

const LOCAL_STATS_MOCK = {
  mainnet: { height: 6482031, txCount: 134209874 },
  testnet: { height: 582441, txCount: 2841937 },
};

const LOCAL_RECENT_MOCK: Record<"mainnet" | "testnet", any[]> = {
  mainnet: [
    {
      hash: "0x8f0a81db92c8a8b0d99577ad44d4d6f1835ff3b9e1d34a6bca8f1c2d20a4f001",
      vmState: "HALT",
      blockIndex: 6482031,
      blockTime: "2026-02-07T09:12:00.000Z",
      sender: "Nb2f7G2kq3dN5Jq8m7j1vWkz4Z9K2p6mQ",
    },
    {
      hash: "0x3cbb4a71f3b63a1ea8ef0f0b0dfde1d6a83807f8e4a7e9bc0ca4ffb49e9e2002",
      vmState: "HALT",
      blockIndex: 6482028,
      blockTime: "2026-02-07T09:08:00.000Z",
      sender: "NeUQdQ5Ti3sB5Nw2vHg2Wd1nBv8zMP4v2K",
    },
    {
      hash: "0xf8e2cd54d3a2f70f1b0eb7c2cd1b32ad9f4632f0570f780f9c7d2d6fb9133003",
      vmState: "FAULT",
      blockIndex: 6482023,
      blockTime: "2026-02-07T09:02:00.000Z",
      sender: "NLsQmVGr8c1Yf5oTj4T1kqqfY4Hw4i1XzQ",
    },
  ],
  testnet: [
    {
      hash: "0x1aa233f3f5b6b8c8d9e01ab12cd34ef56ab78cd90ef1234567890abcdeff1001",
      vmState: "HALT",
      blockIndex: 582441,
      blockTime: "2026-02-07T09:11:00.000Z",
      sender: "NX1Wg6A4Zwq8n4QfY5K7Q9dW3Qx1s9R2LM",
    },
    {
      hash: "0x2bb344f4a6c7d8e9f001bc23de45fa67bc89de01fa2345678901bcdef0aa2002",
      vmState: "HALT",
      blockIndex: 582437,
      blockTime: "2026-02-07T09:06:00.000Z",
      sender: "NV5hV7mVj3Gm1jW5Qv2dC9A4vV6x2N9DQP",
    },
    {
      hash: "0x3cc45505b7d8e9f0012cd34ef56ab78cd90ef1234567890abcdeff1122333003",
      vmState: "HALT",
      blockIndex: 582430,
      blockTime: "2026-02-07T08:57:00.000Z",
      sender: "Nex8kL8zS4mD2fG7pN5qR7uV1xY2wZ3aBc",
    },
  ],
};

const parseResponseData = (payload: unknown) => {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
};

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
  try {
    const cached = uni.getStorageSync(STATS_CACHE_KEY);
    if (cached) stats.value = JSON.parse(cached);
  } catch {}

  let freshStats: any = null;

  if (isLocalPreview) {
    freshStats = LOCAL_STATS_MOCK;
  }

  if (!freshStats) {
    try {
      const res = await uni.request({
        url: `${API_BASE}/stats`,
        method: "GET",
      });
      if (res.statusCode === 200 && res.data) {
        freshStats = parseResponseData(res.data);
      }
    } catch {
      // Ignore and fall back to cached stats.
    }
  }

  if (freshStats && typeof freshStats === "object") {
    stats.value = freshStats as any;
    uni.setStorageSync(STATS_CACHE_KEY, JSON.stringify(freshStats));
  }
};

// Fetch recent transactions via SDK datafeed service
const fetchRecentTxs = async () => {
  try {
    const cached = uni.getStorageSync(TXS_CACHE_KEY);
    if (cached) recentTxs.value = JSON.parse(cached);
  } catch {}

  let freshTxs: any[] = [];
  let hasFreshTxs = false;

  if (isLocalPreview) {
    freshTxs = LOCAL_RECENT_MOCK[selectedNetwork.value];
    hasFreshTxs = true;
  }

  if (!hasFreshTxs) {
    try {
      const res = await uni.request({
        url: `${API_BASE}/recent?network=${selectedNetwork.value}&limit=10`,
        method: "GET",
      });
      if (res.statusCode === 200 && res.data) {
        const parsed = parseResponseData(res.data) as any;
        freshTxs = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
        hasFreshTxs = true;
      }
    } catch {
      // Ignore and fall back to cached txs.
    }
  }

  if (hasFreshTxs) {
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
    if (isLocalPreview) {
      const txMatch = recentTxs.value.find((tx: any) =>
        String(tx?.hash || "")
          .toLowerCase()
          .includes(query.toLowerCase())
      );

      if (txMatch) {
        searchResult.value = { type: "transaction", data: txMatch };
      } else if (query.length >= 20) {
        const transactions = recentTxs.value.slice(0, 3);
        searchResult.value = {
          type: "address",
          data: {
            address: query,
            txCount: transactions.length,
            transactions,
          },
        };
      } else {
        status.value = { msg: t("noResults"), type: "error" };
      }
      return;
    }

    const res = await uni.request({
      url: `${API_BASE}/search?q=${encodeURIComponent(query)}&network=${selectedNetwork.value}`,
      method: "GET",
    });

    if (res.statusCode === 200 && res.data) {
      searchResult.value = parseResponseData(res.data);
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
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
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
