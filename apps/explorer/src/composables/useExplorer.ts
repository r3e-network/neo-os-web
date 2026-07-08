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
import type { MiniAppFramework } from "@shared/react";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { formatNumber } from "@shared/utils/format";
import { getHostOrigin } from "@shared/utils/runtime-origin";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-explorer";
const POLL_INTERVAL_MS = 15000;
const RECENT_TXS_POLL_INTERVAL_MS = 30000;
// app.storage.local keys. The app's storage namespace is pinned to the legacy
// "explorer_" prefix (defineMiniApp storagePrefix), so these resolve to the
// exact pre-framework runtime-cache keys ("explorer_stats_cache" /
// "explorer_txs_cache:<network>") and existing cache entries still hit.
const STATS_CACHE_KEY = "stats_cache";
const TXS_CACHE_KEY_PREFIX = "txs_cache";

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
  // `null` = not yet loaded (renders the "—" placeholder); a real number — even
  // a genuine `0` — renders verbatim, so a live figure is never collapsed to a
  // dash just because the initial default happened to be zero.
  mainnet: { height: number | null; txCount: number | null };
  testnet: { height: number | null; txCount: number | null };
}

export interface UseExplorerOptions {
  /** MiniApp framework — storage (cache) + lifecycle (polling) surfaces. */
  app: MiniAppFramework;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

function isLocalStaticExplorer() {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const isMiniappStaticPath = window.location.pathname.includes("/miniapps/explorer/");
  const isStandaloneViteRoot = import.meta.env.DEV && isLocalHost && window.location.port !== "" && window.location.pathname === "/";
  return isLocalHost && (isMiniappStaticPath || isStandaloneViteRoot);
}

function shouldUseExplorerApi() {
  return !isLocalStaticExplorer();
}

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

export function useExplorer({ app, t }: UseExplorerOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const searchQuery = createObservable("");
  const selectedNetwork = createObservable<"mainnet" | "testnet">("mainnet");
  const isLoading = createObservable(false);
  const isSearching = createObservable(false);
  const searchResult = createObservable<Record<string, unknown> | null>(null);
  const recentTxs = createObservable<TransactionRecord[]>([]);
  // Start unloaded (null), not zero, so the first paint shows the "—"
  // placeholder rather than a literal "0" before the on-mount fetch lands.
  const stats = createObservable<ExplorerStats>({
    mainnet: { height: null, txCount: null },
    testnet: { height: null, txCount: null },
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
    const cached = app.storage.local.get<ExplorerStats>(STATS_CACHE_KEY);
    if (cached) stats.set(cached);
    if (!shouldUseExplorerApi()) return;

    let freshStats: ExplorerStats | null = null;

    try {
      const res = await fetchWithTimeout(`${API_BASE}/stats`);
      if (res.ok) {
        freshStats = parseResponseData(await res.json()) as ExplorerStats;
      }
    } catch (e) {
      console.warn("[useExplorer] fetch stats failed, using cached:", e instanceof Error ? e.message : String(e));
    }

    if (freshStats && typeof freshStats === "object") {
      stats.set(freshStats as ExplorerStats);
      app.storage.local.set(STATS_CACHE_KEY, freshStats);
    }
  };

  let isLoadingTxs = false;
  const loadRecentTxs = async () => {
    // Guard against overlapping reloads (e.g. rapid network toggles): a single
    // in-flight fetch keyed to the latest selectedNetwork is enough.
    if (isLoadingTxs) return;
    isLoadingTxs = true;
    // Capture the network for this load so the cache read/write and the fetch
    // all key off the same value even if the user toggles mid-flight.
    const network = selectedNetwork.get();
    const cacheKey = `${TXS_CACHE_KEY_PREFIX}:${network}`;
    try {
      const cached = app.storage.local.get<TransactionRecord[]>(cacheKey);
      // Only paint the cache when it still matches the active network — a stale
      // read for a network the user already toggled away from must not flash.
      if (cached && selectedNetwork.get() === network) recentTxs.set(cached);
      if (!shouldUseExplorerApi()) return;

      let freshTxs: TransactionRecord[] = [];
      let hasFreshTxs = false;

      try {
        const res = await fetchWithTimeout(`${API_BASE}/recent?network=${network}&limit=10`);
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
        app.storage.local.set(cacheKey, freshTxs);
        // Guard against a slow response landing after the user toggled networks.
        if (selectedNetwork.get() === network) recentTxs.set(freshTxs);
      }
    } finally {
      isLoadingTxs = false;
    }
  };

  // Switching networks must re-scope the recent-tx list to match the stats and
  // search, which both read selectedNetwork at call time. Without this the list
  // keeps showing the previous network's transactions after a toggle. The
  // previous network's search result is also cleared so the metrics-strip
  // "Search result" tile resets to "—" rather than implying the new network
  // returned the old (mainnet) hit.
  selectedNetwork.subscribe(() => {
    searchResult.set(null);
    void loadRecentTxs();
  });

  // ── Search ───────────────────────────────────────────────────────────

  const search = async () => {
    const query = searchQuery.get().trim();
    if (!query) return;
    if (!shouldUseExplorerApi()) return null;

    isSearching.set(true);
    searchResult.set(null);

    try {
      const res = await fetchWithTimeout(`${API_BASE}/search?q=${encodeURIComponent(query)}&network=${selectedNetwork.get()}`);
      if (res.ok) {
        try {
          searchResult.set(parseResponseData(await res.json()));
        } catch (e) {
          console.warn("[useExplorer] search response failed:", e instanceof Error ? e.message : String(e));
          throw new Error(t("explorerServiceUnavailable"));
        }
        return;
      }
      // A 404 is the API's "nothing matched this identifier" signal — surface a
      // calm not-found result rather than leaving the panel blank and silent.
      if (res.status === 404) {
        searchResult.set({ type: "none" });
        return;
      }
      // Any other non-2xx is a genuine failure: re-throw so the host's action
      // wrapper (registerActions errorKey: "searchFailed") shows the error.
      throw new Error(t("searchFailed"));
    } catch (e) {
      if (e instanceof Error && e.message === t("searchFailed")) {
        throw e;
      }
      if (e instanceof Error && e.message === t("explorerServiceUnavailable")) {
        throw e;
      }
      console.warn("[useExplorer] search failed:", e instanceof Error ? e.message : String(e));
      throw new Error(t("explorerServiceUnavailable"));
    } finally {
      isSearching.set(false);
    }
  };

  const viewTx = (hash: string) => {
    searchQuery.set(hash);
    // search() can now reject (genuine non-2xx / network failure). viewTx is
    // fire-and-forget from the recent-tx list, so guard against an unhandled
    // rejection here — the empty result + reset spinner are the user feedback.
    void search().catch(() => {});
  };

  // ── Polling ──────────────────────────────────────────────────────────

  // Stats and the recent-tx lane must both stay live: previously only the
  // height metric ticked while the transaction list went permanently stale.
  // The recent list moves slower and is heavier, so poll it on its own cadence
  // via app.lifecycle.poll (visibility-paused, auto-disposed on unmount); the
  // isLoadingTxs guard inside loadRecentTxs already prevents overlap.
  let stopStatsPoll: (() => void) | null = null;
  let stopTxsPoll: (() => void) | null = null;

  const stopPolling = () => {
    stopStatsPoll?.();
    stopStatsPoll = null;
    stopTxsPoll?.();
    stopTxsPoll = null;
  };

  const startPolling = () => {
    // Restart-safe (loadAll re-runs on pull-to-refresh): drop any live pollers
    // first so a reload never stacks a second interval.
    stopPolling();
    // loadAll just ran both loaders, so the pollers skip the immediate tick.
    stopStatsPoll = app.lifecycle.poll(loadStats, POLL_INTERVAL_MS, { immediate: false });
    stopTxsPoll = app.lifecycle.poll(loadRecentTxs, RECENT_TXS_POLL_INTERVAL_MS, {
      immediate: false,
    });
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
