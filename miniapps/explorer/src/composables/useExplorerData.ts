import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatNumber } from "@shared/utils/format";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { StatItem } from "@shared/components/NeoStats.vue";

export interface TransactionRecord {
  hash: string;
  vmState: string;
  blockIndex: number;
  blockTime: string;
  sender: string;
}

// Detect host URL for API calls (miniapp runs in iframe)
const getApiBase = () => {
  try {
    if (window.parent !== window) {
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

const LOCAL_RECENT_MOCK: Record<"mainnet" | "testnet", TransactionRecord[]> = {
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

const STATS_CACHE_KEY = "explorer_stats_cache";
const TXS_CACHE_KEY = "explorer_txs_cache";

export function useExplorerData(t: (key: string) => string) {
  const { chainType } = useWallet() as WalletSDK;

  const searchQuery = ref("");
  const selectedNetwork = ref<"mainnet" | "testnet">("mainnet");
  const isLoading = ref(false);
  const { status, setStatus, clearStatus } = useStatusMessage();
  const searchResult = ref<Record<string, unknown> | null>(null);
  const recentTxs = ref<TransactionRecord[]>([]);

  const stats = ref({
    mainnet: { height: 0, txCount: 0 },
    testnet: { height: 0, txCount: 0 },
  });

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

  const sidebarItems = computed(() => [
    { label: t("blockHeight"), value: formatNum(stats.value.mainnet.height) },
    { label: t("transactions"), value: formatNum(stats.value.mainnet.txCount) },
    { label: t("sidebarNetwork"), value: selectedNetwork.value },
    { label: t("sidebarRecentTxs"), value: recentTxs.value.length },
  ]);

  const fetchStats = async () => {
    try {
      const cached = uni.getStorageSync(STATS_CACHE_KEY);
      if (cached) stats.value = JSON.parse(cached);
    } catch {
      /* Cache read failure is non-critical */
    }

    let freshStats: typeof stats.value | null = null;

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
      stats.value = freshStats as typeof stats.value;
      uni.setStorageSync(STATS_CACHE_KEY, JSON.stringify(freshStats));
    }
  };

  const fetchRecentTxs = async () => {
    try {
      const cached = uni.getStorageSync(TXS_CACHE_KEY);
      if (cached) recentTxs.value = JSON.parse(cached);
    } catch {
      /* Cache read failure is non-critical */
    }

    let freshTxs: TransactionRecord[] = [];
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
          const parsed = parseResponseData(res.data) as Record<string, unknown> | null;
          freshTxs = Array.isArray(parsed?.transactions) ? (parsed.transactions as Record<string, unknown>[]) : [];
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
      setStatus(t("pleaseEnterQuery"), "error");
      return;
    }

    isLoading.value = true;
    searchResult.value = null;
    clearStatus();

    try {
      if (isLocalPreview) {
        const txMatch = recentTxs.value.find((tx: TransactionRecord) =>
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
          setStatus(t("noResults"), "error");
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
        setStatus(t("noResults"), "error");
      }
    } catch (e: unknown) {
      setStatus(t("searchFailed"), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const startPolling = () => {
    fetchStats();
    fetchRecentTxs();
    statsInterval = setInterval(fetchStats, 15000);
  };

  const stopPolling = () => {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  };

  const watchNetwork = () => {
    watch(selectedNetwork, () => {
      fetchRecentTxs();
    });
  };

  return {
    searchQuery,
    selectedNetwork,
    isLoading,
    status,
    searchResult,
    recentTxs,
    stats,
    mainnetStats,
    testnetStats,
    sidebarItems,
    search,
    startPolling,
    stopPolling,
    watchNetwork,
  };
}
