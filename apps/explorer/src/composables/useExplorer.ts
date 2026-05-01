/**
 * useExplorer — Simplified domain logic for the Explorer miniapp
 *
 * This composable encapsulates blockchain data fetching, search, and
 * stats polling. It replaces the legacy useExplorerData.ts by receiving
 * ChainService + EventBus from PlatformServices instead of wiring
 * infrastructure directly.
 *
 * Key differences from legacy:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *   - No usePlatformServices() inject — services are passed in explicitly
 *   - Stats/sidebar driven by manifest, not manually constructed
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import { formatNumber } from "@shared/utils/format";
import { useTicker } from "@shared/composables/useTicker";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { getParentOrigin } from "@shared/utils/iframe";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-explorer";
const POLL_INTERVAL_MS = 15000;
const STATS_CACHE_KEY = "explorer_stats_cache";
const TXS_CACHE_KEY = "explorer_txs_cache";

// ============================================================================
// Types
// ============================================================================

export interface TransactionRecord {
  hash: string;
  vmState: string;
  blockIndex: number;
  blockTime: string;
  sender: string;
}

export interface ExplorerStats {
  mainnet: { height: number; txCount: number };
  testnet: { height: number; txCount: number };
}

export interface UseExplorerOptions {
  /** ChainService instance from PlatformServices */
  chain: ChainService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

const getApiBase = () => {
  const parentOrigin = getParentOrigin();
  return parentOrigin !== window.location.origin ? `${parentOrigin}/api/explorer` : "/api/explorer";
};

const API_BASE = getApiBase();
const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

const LOCAL_STATS_MOCK: ExplorerStats = {
  mainnet: { height: 6482031, txCount: 134209874 },
  testnet: { height: 582441, txCount: 2841937 },
};

const LOCAL_RECENT_MOCK: Record<"mainnet" | "testnet", TransactionRecord[]> = {
  mainnet: [
    { hash: "0x8f0a81db92c8a8b0d99577ad44d4d6f1835ff3b9e1d34a6bca8f1c2d20a4f001", vmState: "HALT", blockIndex: 6482031, blockTime: "2026-02-07T09:12:00.000Z", sender: "Nb2f7G2kq3dN5Jq8m7j1vWkz4Z9K2p6mQ" },
    { hash: "0x3cbb4a71f3b63a1ea8ef0f0b0dfde1d6a83807f8e4a7e9bc0ca4ffb49e9e2002", vmState: "HALT", blockIndex: 6482028, blockTime: "2026-02-07T09:08:00.000Z", sender: "NeUQdQ5Ti3sB5Nw2vHg2Wd1nBv8zMP4v2K" },
    { hash: "0xf8e2cd54d3a2f70f1b0eb7c2cd1b32ad9f4632f0570f780f9c7d2d6fb9133003", vmState: "FAULT", blockIndex: 6482023, blockTime: "2026-02-07T09:02:00.000Z", sender: "NLsQmVGr8c1Yf5oTj4T1kqqfY4Hw4i1XzQ" },
  ],
  testnet: [
    { hash: "0x1aa233f3f5b6b8c8d9e01ab12cd34ef56ab78cd90ef1234567890abcdeff1001", vmState: "HALT", blockIndex: 582441, blockTime: "2026-02-07T09:11:00.000Z", sender: "NX1Wg6A4Zwq8n4QfY5K7Q9dW3Qx1s9R2LM" },
    { hash: "0x2bb344f4a6c7d8e9f001bc23de45fa67bc89de01fa2345678901bcdef0aa2002", vmState: "HALT", blockIndex: 582437, blockTime: "2026-02-07T09:06:00.000Z", sender: "NV5hV7mVj3Gm1jW5Qv2dC9A4vV6x2N9DQP" },
    { hash: "0x3cc45505b7d8e9f0012cd34ef56ab78cd90ef1234567890abcdeff1122333003", vmState: "HALT", blockIndex: 582430, blockTime: "2026-02-07T08:57:00.000Z", sender: "Nex8kL8zS4mD2fG7pN5qR7uV1xY2wZ3aBc" },
  ],
};

const parseResponseData = (payload: unknown) => {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (e) {
      return null;
    }
  }
  return payload;
};

// ============================================================================
// Composable
// ============================================================================

export function useExplorer({ chain, eventBus, t }: UseExplorerOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const searchQuery = createObservable("");
  const selectedNetwork = createObservable<"mainnet" | "testnet">("mainnet");
  const isLoading = createObservable(false);
  const isSearching = createObservable(false);
  const searchResult = createObservable<Record<string, unknown> | null>(null);
  const recentTxs = createObservable<TransactionRecord[]>([]);
  const stats = createObservable<ExplorerStats>({
    mainnet: { height: 0, txCount: 0 },
    testnet: { height: 0, txCount: 0 },
  });

  // ── Formatted values for manifest bindings ───────────────────────────
  const formatNum = (n: number) => formatNumber(n, 0);

  const mainnetHeight: Observable = {
    get: () => formatNum(stats.get().mainnet.height),
    set: () => {},
    subscribe: (listener) => stats.subscribe(listener),
  };
  const mainnetTxCount: Observable = {
    get: () => formatNum(stats.get().mainnet.txCount),
    set: () => {},
    subscribe: (listener) => stats.subscribe(listener),
  };
  const testnetHeight: Observable = {
    get: () => formatNum(stats.get().testnet.height),
    set: () => {},
    subscribe: (listener) => stats.subscribe(listener),
  };
  const testnetTxCount: Observable = {
    get: () => formatNum(stats.get().testnet.txCount),
    set: () => {},
    subscribe: (listener) => stats.subscribe(listener),
  };
  const recentTxCount: Observable = {
    get: () => recentTxs.get().length,
    set: () => {},
    subscribe: (listener) => recentTxs.subscribe(listener),
  };

  // ── Data Loading ─────────────────────────────────────────────────────

  const loadStats = async () => {
    const cached = readCachedJSON<ExplorerStats>(STATS_CACHE_KEY);
    if (cached) stats.set(cached);

    let freshStats: ExplorerStats | null = null;

    if (isLocalPreview) {
      freshStats = LOCAL_STATS_MOCK;
    }

    if (!freshStats) {
      try {
        const res = await fetch(`${API_BASE}/stats`);
        if (res.ok) {
          freshStats = parseResponseData(await res.json());
        }
      } catch (e) {
        console.warn("[useExplorer] fetch stats failed, using cached:", e instanceof Error ? e.message : String(e));
      }
    }

    if (freshStats && typeof freshStats === "object") {
      stats.set(freshStats as ExplorerStats);
      writeCachedJSON(STATS_CACHE_KEY, freshStats);
    }
  };

  const loadRecentTxs = async () => {
    const cached = readCachedJSON<TransactionRecord[]>(TXS_CACHE_KEY);
    if (cached) recentTxs.set(cached);

    let freshTxs: TransactionRecord[] = [];
    let hasFreshTxs = false;

    if (isLocalPreview) {
      freshTxs = LOCAL_RECENT_MOCK[selectedNetwork.get()];
      hasFreshTxs = true;
    }

    if (!hasFreshTxs) {
      try {
        const res = await fetch(`${API_BASE}/recent?network=${selectedNetwork.get()}&limit=10`);
        if (res.ok) {
          const parsed = parseResponseData(await res.json()) as Record<string, unknown> | null;
          freshTxs = Array.isArray(parsed?.transactions) ? (parsed.transactions as TransactionRecord[]) : [];
          hasFreshTxs = true;
        }
      } catch (e) {
        console.warn("[useExplorer] fetch txs failed, using cached:", e instanceof Error ? e.message : String(e));
      }
    }

    if (hasFreshTxs) {
      recentTxs.set(freshTxs);
      writeCachedJSON(TXS_CACHE_KEY, freshTxs);
    }
  };

  // ── Search ───────────────────────────────────────────────────────────

  const search = async () => {
    const query = searchQuery.get().trim();
    if (!query) return;

    isSearching.set(true);
    searchResult.set(null);

    try {
      if (isLocalPreview) {
        const txMatch = recentTxs.get().find((tx) =>
          String(tx?.hash || "").toLowerCase().includes(query.toLowerCase()),
        );
        if (txMatch) {
          searchResult.set({ type: "transaction", data: txMatch });
        } else if (query.length >= 20) {
          const transactions = recentTxs.get().slice(0, 3);
          searchResult.set({
            type: "address",
            data: { address: query, txCount: transactions.length, transactions },
          });
        }
        return;
      }

      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&network=${selectedNetwork.get()}`);
      if (res.ok) {
        searchResult.set(parseResponseData(await res.json()));
      }
    } catch (e) {
      eventBus.emit("explorer:error", {
        message: e instanceof Error ? e.message : t("searchFailed"),
      });
    } finally {
      isSearching.set(false);
    }
  };

  const viewTx = (hash: string) => {
    searchQuery.set(hash);
    search();
  };

  // ── Polling ──────────────────────────────────────────────────────────

  const statsTicker = useTicker(loadStats, POLL_INTERVAL_MS);

  const startPolling = () => {
    statsTicker.start();
  };

  const stopPolling = () => {
    statsTicker.stop();
  };

  /**
   * Load all data — called by defineMiniApp on mount.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      await Promise.all([loadStats(), loadRecentTxs()]);
      startPolling();
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // ── Raw State ──────────────────────────────────────────────────
    searchQuery,
    selectedNetwork,
    isLoading,
    isSearching,
    searchResult,
    recentTxs,
    stats,

    // ── Formatted values (for manifest stat/sidebar bindings) ──────
    mainnetHeight,
    mainnetTxCount,
    testnetHeight,
    testnetTxCount,
    recentTxCount,

    // ── Actions ────────────────────────────────────────────────────
    search,
    viewTx,
    loadAll,
    stopPolling,
  };
}

/** Return type of useExplorer for external typing */
export type UseExplorerReturn = ReturnType<typeof useExplorer>;
