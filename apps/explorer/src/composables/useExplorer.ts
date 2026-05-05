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
import { getHostOrigin } from "@shared/utils/runtime-origin";

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
  mainnet: { height: number; txCount: number | null };
  testnet: { height: number; txCount: number | null };
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
  const hostOrigin = getHostOrigin();
  return hostOrigin && hostOrigin !== window.location.origin ? `${hostOrigin}/api/explorer` : "/api/explorer";
};

const API_BASE = getApiBase();

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

const normalizeTx = (tx: Record<string, unknown>): TransactionRecord => ({
  hash: String(tx.hash || tx.tx_hash || ""),
  vmState: String(tx.vmState || tx.vm_state || tx.vmstate || ""),
  blockIndex: Number(tx.blockIndex || tx.block_index || tx.blockindex || 0),
  blockTime: String(tx.blockTime || tx.block_time || tx.blocktime || ""),
  sender: String(tx.sender || ""),
});

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
  const formatNum = (n: number | null) => (typeof n === "number" ? formatNumber(n, 0) : t("notAvailable"));

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

    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        freshStats = parseResponseData(await res.json()) as ExplorerStats;
      }
    } catch (e) {
      console.warn("[useExplorer] fetch stats failed, using cached:", e instanceof Error ? e.message : String(e));
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

    try {
      const res = await fetch(`${API_BASE}/recent?network=${selectedNetwork.get()}&limit=10`);
      if (res.ok) {
        const parsed = parseResponseData(await res.json()) as Record<string, unknown> | null;
        const rows = Array.isArray(parsed?.transactions) ? (parsed.transactions as Record<string, unknown>[]) : [];
        freshTxs = rows.map(normalizeTx).filter((tx) => tx.hash);
        hasFreshTxs = true;
      }
    } catch (e) {
      console.warn("[useExplorer] fetch txs failed, using cached:", e instanceof Error ? e.message : String(e));
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
