<template>
  <view class="app-container">
    <!-- Header with Network Stats -->
    <view class="header">
      <text class="title">Neo Explorer</text>
      <text class="subtitle">Search transactions, addresses, contracts</text>
    </view>

    <!-- Network Stats Cards -->
    <view class="stats-grid">
      <view class="network-card mainnet">
        <text class="network-label">Mainnet</text>
        <view class="network-stats">
          <view class="stat-item">
            <text class="stat-value">{{ formatNum(stats.mainnet.height) }}</text>
            <text class="stat-label">Block Height</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ formatNum(stats.mainnet.txCount) }}</text>
            <text class="stat-label">Transactions</text>
          </view>
        </view>
      </view>
      <view class="network-card testnet">
        <text class="network-label">Testnet</text>
        <view class="network-stats">
          <view class="stat-item">
            <text class="stat-value">{{ formatNum(stats.testnet.height) }}</text>
            <text class="stat-label">Block Height</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ formatNum(stats.testnet.txCount) }}</text>
            <text class="stat-label">Transactions</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Search Section -->
    <view class="search-section">
      <view class="search-box">
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="Search tx hash, address, or contract..."
          @confirm="search"
        />
        <view class="search-btn" @click="search">
          <text>Search</text>
        </view>
      </view>
      <view class="network-toggle">
        <view :class="['toggle-btn', selectedNetwork === 'mainnet' && 'active']" @click="selectedNetwork = 'mainnet'">
          <text>Mainnet</text>
        </view>
        <view :class="['toggle-btn', selectedNetwork === 'testnet' && 'active']" @click="selectedNetwork = 'testnet'">
          <text>Testnet</text>
        </view>
      </view>
    </view>

    <!-- Status Message -->
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <!-- Loading -->
    <view v-if="isLoading" class="loading">
      <text>Searching...</text>
    </view>

    <!-- Search Results -->
    <view v-if="searchResult" class="result-section">
      <text class="section-title">Search Result</text>

      <!-- Transaction Result -->
      <view v-if="searchResult.type === 'transaction'" class="result-card">
        <view class="result-header">
          <text class="result-type">Transaction</text>
          <text :class="['vm-state', searchResult.data.vmState]">
            {{ searchResult.data.vmState }}
          </text>
        </view>
        <view class="result-row">
          <text class="label">Hash:</text>
          <text class="value hash">{{ searchResult.data.hash }}</text>
        </view>
        <view class="result-row">
          <text class="label">Block:</text>
          <text class="value">{{ searchResult.data.blockIndex }}</text>
        </view>
        <view class="result-row">
          <text class="label">Time:</text>
          <text class="value">{{ formatTime(searchResult.data.blockTime) }}</text>
        </view>
        <view class="result-row">
          <text class="label">Sender:</text>
          <text class="value addr">{{ searchResult.data.sender }}</text>
        </view>
        <view class="result-row">
          <text class="label">System Fee:</text>
          <text class="value">{{ searchResult.data.systemFee }} GAS</text>
        </view>
        <view class="result-row">
          <text class="label">Network Fee:</text>
          <text class="value">{{ searchResult.data.networkFee }} GAS</text>
        </view>
      </view>

      <!-- Address Result -->
      <view v-else-if="searchResult.type === 'address'" class="result-card">
        <view class="result-header">
          <text class="result-type">Address</text>
        </view>
        <view class="result-row">
          <text class="label">Address:</text>
          <text class="value addr">{{ searchResult.data.address }}</text>
        </view>
        <view class="result-row">
          <text class="label">Transactions:</text>
          <text class="value">{{ searchResult.data.txCount }}</text>
        </view>
        <view class="tx-list" v-if="searchResult.data.transactions?.length">
          <text class="list-title">Recent Transactions</text>
          <view v-for="tx in searchResult.data.transactions" :key="tx.hash" class="tx-item" @click="viewTx(tx.hash)">
            <text class="tx-hash">{{ truncateHash(tx.hash) }}</text>
            <text class="tx-time">{{ formatTime(tx.blockTime) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Recent Transactions -->
    <view v-if="!searchResult && recentTxs.length" class="recent-section">
      <text class="section-title">Recent Transactions</text>
      <view v-for="tx in recentTxs" :key="tx.hash" class="tx-item" @click="viewTx(tx.hash)">
        <view class="tx-info">
          <text class="tx-hash">{{ truncateHash(tx.hash) }}</text>
          <text :class="['vm-state-small', tx.vmState]">{{ tx.vmState }}</text>
        </view>
        <text class="tx-time">{{ formatTime(tx.blockTime) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { formatNumber } from "@/shared/utils/format";

const API_BASE = "/api/explorer";

// State
const searchQuery = ref("");
const selectedNetwork = ref<"mainnet" | "testnet">("testnet");
const isLoading = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);
interface TxSummary {
  hash: string;
  blockIndex: number;
  blockTime: string;
  vmState: string;
  sender: string;
  systemFee: string;
  networkFee: string;
}

interface SearchResult {
  type: "transaction" | "address" | "contract" | "unknown";
  found: boolean;
  data?: {
    hash?: string;
    blockIndex?: number;
    blockTime?: string;
    vmState?: string;
    sender?: string;
    systemFee?: string;
    networkFee?: string;
    address?: string;
    txCount?: number;
    transactions?: TxSummary[];
  };
}

const searchResult = ref<SearchResult | null>(null);
const recentTxs = ref<TxSummary[]>([]);

const stats = ref({
  mainnet: { height: 0, txCount: 0 },
  testnet: { height: 0, txCount: 0 },
});

// Formatters
const formatNum = (n: number) => formatNumber(n, 0);

const formatTime = (time: string) => {
  const d = new Date(time);
  return d.toLocaleString();
};

const truncateHash = (hash: string) => {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

// Fetch network stats
const fetchStats = async () => {
  try {
    const res = await uni.request({
      url: `${API_BASE}/stats`,
      method: "GET",
    });
    if (res.statusCode === 200 && res.data) {
      stats.value = res.data as typeof stats.value;
    }
  } catch (e) {
    console.error("Failed to fetch stats:", e);
  }
};

// Fetch recent transactions
const fetchRecentTxs = async () => {
  try {
    const res = await uni.request({
      url: `${API_BASE}/recent?network=${selectedNetwork.value}&limit=10`,
      method: "GET",
    });
    if (res.statusCode === 200 && res.data) {
      recentTxs.value = ((res.data as Record<string, unknown>)?.transactions as TxSummary[]) || [];
    }
  } catch (e) {
    console.error("Failed to fetch recent txs:", e);
  }
};

// Search
const search = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    status.value = { msg: "Please enter a search query", type: "error" };
    return;
  }
  // Validate search input format
  if (query.length > 128) {
    status.value = { msg: "Query too long", type: "error" };
    return;
  }
  if (!/^(0x[0-9a-fA-F]+|N[A-Za-z0-9]+)$/.test(query)) {
    status.value = { msg: "Invalid format. Enter a tx hash (0x...), address (N...), or contract hash (0x...)", type: "error" };
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
      status.value = { msg: "No results found", type: "error" };
    }
  } catch (e: unknown) {
    status.value = { msg: e instanceof Error ? e.message : "Search failed", type: "error" };
  } finally {
    isLoading.value = false;
  }
};

// View transaction details
const viewTx = (hash: string) => {
  searchQuery.value = hash;
  search();
};

// Initialize
let statsTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchStats();
  fetchRecentTxs();
  statsTimer = setInterval(fetchStats, 15000);
});

onUnmounted(() => {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
});
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: $color-text-primary;
  padding: 16px;
}

.header {
  text-align: center;
  margin-bottom: 20px;
}

.title {
  font-size: 1.6em;
  font-weight: bold;
  color: $color-explorer;
}

.subtitle {
  color: $color-text-secondary;
  font-size: 0.85em;
  margin-top: 6px;
}

.stats-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.network-card {
  flex: 1;
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 12px;
  padding: 14px;

  &.mainnet {
    border-left: 3px solid $color-mainnet;
  }

  &.testnet {
    border-left: 3px solid $color-testnet;
  }
}

.network-label {
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 10px;
  display: block;
}

.mainnet .network-label {
  color: $color-mainnet;
}

.testnet .network-label {
  color: $color-testnet;
}

.network-stats {
  display: flex;
  gap: 8px;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 1.1em;
  font-weight: bold;
  color: $color-text-primary;
  display: block;
}

.stat-label {
  font-size: 0.7em;
  color: $color-text-secondary;
}

.search-section {
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 8px;
  padding: 12px;
  color: $color-text-primary;
  font-size: 0.9em;
}

.search-btn {
  background: $color-explorer;
  color: $color-text-on-brand;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: bold;
  &:active {
    filter: brightness(0.85);
  }
}

.network-toggle {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  text-align: center;
  padding: 10px;
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 8px;
  color: $color-text-secondary;

  &.active {
    border-color: $color-explorer;
    color: $color-explorer;
  }
  &:active {
    filter: brightness(0.85);
  }
}

.status-msg {
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 16px;

  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }

  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.loading {
  text-align: center;
  padding: 20px;
  color: $color-text-secondary;
}

.section-title {
  font-size: 1em;
  font-weight: bold;
  color: $color-explorer;
  margin-bottom: 12px;
  display: block;
}

.result-section,
.recent-section {
  margin-top: 20px;
}

.result-card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 12px;
  padding: 16px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid $color-border;
}

.result-type {
  font-weight: bold;
  color: $color-explorer;
}

.vm-state {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: bold;

  &.HALT {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }

  &.FAULT {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}

.result-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid rgba($color-border, 0.5);

  &:last-child {
    border-bottom: none;
  }
}

.label {
  width: 100px;
  color: $color-text-secondary;
  font-size: 0.85em;
}

.value {
  flex: 1;
  font-size: 0.85em;
  word-break: break-all;

  &.hash,
  &.addr {
    font-family: monospace;
    color: $color-explorer;
  }
}

.tx-list {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $color-border;
}

.list-title {
  font-size: 0.9em;
  color: $color-text-secondary;
  margin-bottom: 10px;
  display: block;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 8px;
  margin-bottom: 8px;
  &:active {
    filter: brightness(0.85);
  }
}

.tx-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tx-hash {
  font-family: monospace;
  font-size: 0.85em;
  color: $color-explorer;
}

.tx-time {
  font-size: 0.75em;
  color: $color-text-secondary;
}

.vm-state-small {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.65em;

  &.HALT {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }

  &.FAULT {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}
</style>
