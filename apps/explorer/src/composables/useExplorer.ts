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
import { addressToScriptHash } from "@shared/utils/neo";

// ============================================================================
// Constants
// ============================================================================

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

export type ExplorerNetwork = "mainnet" | "testnet";
export type ExplorerQueryType = "block" | "hash" | "address" | "contract";
export type ExplorerDataStatus = "loading" | "live" | "cached" | "empty" | "unavailable";

export interface ExplorerSearchResult extends Record<string, unknown> {
  type: string;
  found: boolean;
  network: ExplorerNetwork;
  query: string;
  source?: string;
}

export interface ExplorerNetworkStats {
  height: number | null;
  txCount: number | null;
  txCountSource: "indexer" | "unavailable";
}

export interface ExplorerStats {
  // `null` = not yet loaded (renders the "—" placeholder). Transaction totals
  // may genuinely be zero; chain height zero is reserved by the API as its
  // RPC-unavailable sentinel and is normalized to `null` below.
  mainnet: ExplorerNetworkStats;
  testnet: ExplorerNetworkStats;
  timestamp: number | null;
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
    } catch {
      return null;
    }
  }
  return payload;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** Match the exact identifier forms accepted by the production explorer API. */
export function classifyExplorerQuery(value: unknown): ExplorerQueryType | null {
  const query = String(value ?? "").trim();
  if (/^\d{1,10}$/.test(query)) return "block";
  if (/^0x[0-9a-fA-F]{64}$/.test(query)) return "hash";
  if (/^0x[0-9a-fA-F]{40}$/.test(query)) return "contract";
  if (/^N[A-Za-z0-9]{33}$/.test(query)) {
    try {
      return /^0x[0-9a-f]{40}$/.test(addressToScriptHash(query)) ? "address" : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeNetworkStats(value: unknown): ExplorerNetworkStats {
  const record = asRecord(value);
  const height = asNonNegativeInteger(record?.height);
  const txCountSource = record?.txCountSource === "indexer" ? "indexer" : "unavailable";
  const txCount = txCountSource === "indexer"
    ? asNonNegativeInteger(record?.txCount)
    : null;
  // A live Neo N3 endpoint returning zero represents the API's RPC-unavailable
  // sentinel, not a believable current chain height.
  return {
    height: height && height > 0 ? height : null,
    txCount,
    txCountSource,
  };
}

export function normalizeExplorerStats(value: unknown): ExplorerStats | null {
  const record = asRecord(value);
  if (!record) return null;
  const mainnet = normalizeNetworkStats(record.mainnet);
  const testnet = normalizeNetworkStats(record.testnet);
  const timestamp = asNonNegativeInteger(record.timestamp);
  if (
    mainnet.height == null && mainnet.txCount == null &&
    testnet.height == null && testnet.txCount == null
  ) return null;
  return { mainnet, testnet, timestamp: timestamp && timestamp > 0 ? timestamp : null };
}

export function normalizeExplorerSearchResult(
  value: unknown,
  query: string,
  network: ExplorerNetwork,
): ExplorerSearchResult {
  const record = asRecord(parseResponseData(value));
  const type = typeof record?.type === "string" ? record.type : "unknown";
  const found = record?.found === true;
  const reportedNetwork = record?.network === "testnet" || record?.network === "mainnet"
    ? record.network
    : null;
  // The requested network is the trust boundary for a record. A mismatched
  // response must never be painted as if it belonged to the active network.
  if (reportedNetwork && reportedNetwork !== network) {
    return {
      type: "unavailable",
      found: false,
      network,
      query,
      source: "network_mismatch",
      reportedNetwork,
    };
  }
  return {
    ...(record ?? {}),
    type,
    found,
    network,
    query,
  };
}

const normalizeTx = (tx: Record<string, unknown>): TransactionRecord => ({
  hash: String(tx.hash || tx.tx_hash || ""),
  vmState: String(tx.vmState || tx.vm_state || tx.vmstate || ""),
  blockIndex: asNonNegativeInteger(tx.blockIndex ?? tx.block_index ?? tx.blockindex) ?? 0,
  blockTime: String(tx.blockTime || tx.block_time || tx.blocktime || ""),
  sender: String(tx.sender || ""),
});

// ============================================================================
// Composable
// ============================================================================

export function useExplorer({ app, t }: UseExplorerOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const searchQuery = createObservable("");
  const selectedNetwork = createObservable<ExplorerNetwork>("mainnet");
  const isLoading = createObservable(false);
  const isSearching = createObservable(false);
  const searchResult = createObservable<ExplorerSearchResult | null>(null);
  const recentTxs = createObservable<TransactionRecord[]>([]);
  const statsStatus = createObservable<ExplorerDataStatus>("loading");
  const recentStatus = createObservable<ExplorerDataStatus>("loading");
  const statsUpdatedAt = createObservable<number | null>(null);
  // Start unloaded (null), not zero, so the first paint shows the "—"
  // placeholder rather than a literal "0" before the on-mount fetch lands.
  const stats = createObservable<ExplorerStats>({
    mainnet: { height: null, txCount: null, txCountSource: "unavailable" },
    testnet: { height: null, txCount: null, txCountSource: "unavailable" },
    timestamp: null,
  });

  // ── Formatted values for manifest bindings ───────────────────────────
  /**
   * Three states, not two. `statsStatus` is the settled signal this app already
   * tracks, so absence can say WHICH kind of absence it is:
   *
   *   · still reading  → `undefined`. Nothing has been set yet. The manifest
   *     binding's `pendingKey` turns this into words in the chrome, which has
   *     no loading gate of its own and would otherwise format the void into a
   *     dash. The PlayArea reads the same `undefined` as "no data" and shows
   *     its skeleton, exactly as it already did for the dash.
   *   · settled, and the chain had nothing → "N/A". A real answer about the
   *     chain, and NOT the same state as "still reading", so it must not
   *     borrow that copy.
   *   · settled with a value → the number.
   */
  const formatNum = (n: number | null) => {
    if (typeof n === "number") return formatNumber(n, 0);
    return statsStatus.get() === "loading" ? undefined : t("notAvailable");
  };

  /** Both sources matter: the value lands on `stats`, the phase on `statsStatus`. */
  const subscribeStats = (listener: () => void) => {
    const unsubs = [stats.subscribe(listener), statsStatus.subscribe(listener)];
    return () => unsubs.forEach((unsub) => unsub());
  };

  const mainnetHeight: Observable = {
    get: () => formatNum(stats.get().mainnet.height),
    set: () => {},
    subscribe: subscribeStats,
  };
  const mainnetTxCount: Observable = {
    get: () => formatNum(stats.get().mainnet.txCount),
    set: () => {},
    subscribe: subscribeStats,
  };
  const testnetHeight: Observable = {
    get: () => formatNum(stats.get().testnet.height),
    set: () => {},
    subscribe: subscribeStats,
  };
  const testnetTxCount: Observable = {
    get: () => formatNum(stats.get().testnet.txCount),
    set: () => {},
    subscribe: subscribeStats,
  };
  const recentTxCount: Observable = {
    // A count is a claim: `Recent TXs 0` asserts this chain is idle. It is only
    // true when a read actually came back and found nothing. The same three
    // states as the height/tx tiles above:
    //   · loading      → `undefined`; nothing has been set yet.
    //   · unavailable  → "N/A"; the read failed, so the count is unknown —
    //     reporting the empty list's length as 0 would invent a reading.
    //   · live/cached/empty → the real length. A settled zero survives.
    get: () => {
      const status = recentStatus.get();
      if (status === "loading") return undefined;
      if (status === "unavailable") return t("notAvailable");
      return recentTxs.get().length;
    },
    set: () => {},
    subscribe: (listener) => {
      const unsubs = [recentTxs.subscribe(listener), recentStatus.subscribe(listener)];
      return () => unsubs.forEach((unsub) => unsub());
    },
  };

  // ── Data Loading ─────────────────────────────────────────────────────

  const loadStats = async () => {
    const currentStats = stats.get();
    const hasCurrentStats = Boolean(
      currentStats.mainnet.height != null || currentStats.mainnet.txCount != null ||
      currentStats.testnet.height != null || currentStats.testnet.txCount != null,
    );
    let hasCachedStats = false;
    try {
      const cached = normalizeExplorerStats(app.storage.local.get<unknown>(STATS_CACHE_KEY));
      if (cached) {
        hasCachedStats = true;
        // Hydrate once. Polling should not flash a healthy live surface back to
        // "cached" before every request completes.
        if (!hasCurrentStats) {
          stats.set(cached);
          statsUpdatedAt.set(cached.timestamp);
          statsStatus.set("cached");
        }
      }
    } catch (error) {
      console.warn("[useExplorer] stats cache read failed:", error instanceof Error ? error.message : String(error));
    }
    if (!shouldUseExplorerApi()) {
      if (!hasCachedStats) statsStatus.set("unavailable");
      return;
    }

    let freshStats: ExplorerStats | null = null;

    try {
      const res = await fetchWithTimeout(`${API_BASE}/stats`);
      if (res.ok) {
        freshStats = normalizeExplorerStats(await res.json());
      }
    } catch (e) {
      console.warn("[useExplorer] fetch stats failed, using cached:", e instanceof Error ? e.message : String(e));
    }

    if (freshStats) {
      stats.set(freshStats);
      statsUpdatedAt.set(freshStats.timestamp ?? Date.now());
      statsStatus.set("live");
      try {
        app.storage.local.set(STATS_CACHE_KEY, freshStats);
      } catch (error) {
        console.warn("[useExplorer] stats cache write failed:", error instanceof Error ? error.message : String(error));
      }
    } else {
      statsStatus.set(hasCachedStats || hasCurrentStats ? "cached" : "unavailable");
    }
  };

  let isLoadingTxs = false;
  let queuedTxReload = false;
  const loadRecentTxs = async () => {
    // Guard against overlapping reloads (e.g. rapid network toggles): a single
    // in-flight fetch keyed to the latest selectedNetwork is enough.
    if (isLoadingTxs) {
      queuedTxReload = true;
      return;
    }
    isLoadingTxs = true;
    // Capture the network for this load so the cache read/write and the fetch
    // all key off the same value even if the user toggles mid-flight.
    const network = selectedNetwork.get();
    const cacheKey = `${TXS_CACHE_KEY_PREFIX}:${network}`;
    try {
      const hasCurrentTxs = recentTxs.get().length > 0;
      const currentRecentStatus = recentStatus.get();
      const hasCurrentSnapshot = hasCurrentTxs || ["live", "empty", "cached"].includes(currentRecentStatus);
      let cached: TransactionRecord[] | null = null;
      try {
        const stored = app.storage.local.get<unknown>(cacheKey);
        cached = Array.isArray(stored)
          ? stored
            .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
            .map(normalizeTx)
            .filter((tx) => tx.hash)
          : null;
      } catch (error) {
        console.warn("[useExplorer] tx cache read failed:", error instanceof Error ? error.message : String(error));
      }
      // Only paint the cache when it still matches the active network — a stale
      // read for a network the user already toggled away from must not flash.
      if (cached && !hasCurrentSnapshot && selectedNetwork.get() === network) {
        recentTxs.set(cached);
        recentStatus.set("cached");
      }
      if (!shouldUseExplorerApi()) {
        recentStatus.set(cached || hasCurrentSnapshot ? "cached" : "unavailable");
        return;
      }

      let freshTxs: TransactionRecord[] = [];
      let hasFreshTxs = false;

      try {
        const res = await fetchWithTimeout(`${API_BASE}/recent?network=${network}&limit=10`);
        if (res.ok) {
          const parsed = asRecord(parseResponseData(await res.json()));
          const rows = Array.isArray(parsed?.transactions) ? (parsed.transactions as Record<string, unknown>[]) : [];
          freshTxs = rows.map(normalizeTx).filter((tx) => tx.hash);
          hasFreshTxs = parsed?.source !== "unavailable";
          if (selectedNetwork.get() === network && parsed?.source === "unavailable") {
            recentStatus.set(cached || hasCurrentSnapshot ? "cached" : "unavailable");
          }
        }
      } catch (e) {
        console.warn("[useExplorer] fetch txs failed, using cached:", e instanceof Error ? e.message : String(e));
      }

      if (hasFreshTxs) {
        try {
          app.storage.local.set(cacheKey, freshTxs);
        } catch (error) {
          console.warn("[useExplorer] tx cache write failed:", error instanceof Error ? error.message : String(error));
        }
        // Guard against a slow response landing after the user toggled networks.
        if (selectedNetwork.get() === network) {
          recentTxs.set(freshTxs);
          recentStatus.set(freshTxs.length > 0 ? "live" : "empty");
        }
      } else if (selectedNetwork.get() === network) {
        recentStatus.set(cached || hasCurrentSnapshot ? "cached" : "unavailable");
      }
    } finally {
      isLoadingTxs = false;
      if (queuedTxReload) {
        queuedTxReload = false;
        void loadRecentTxs();
      }
    }
  };

  // Switching networks must re-scope the recent-tx list to match the stats and
  // search, which both read selectedNetwork at call time. Without this the list
  // keeps showing the previous network's transactions after a toggle. The
  // previous network's search result is also cleared so the metrics-strip
  // "Search result" tile resets to "—" rather than implying the new network
  // returned the old (mainnet) hit.
  let searchGeneration = 0;
  selectedNetwork.subscribe(() => {
    searchGeneration += 1;
    isSearching.set(false);
    searchResult.set(null);
    recentTxs.set([]);
    recentStatus.set("loading");
    void loadRecentTxs();
  });

  // ── Search ───────────────────────────────────────────────────────────

  const search = async () => {
    const query = searchQuery.get().trim();
    if (!query) return;
    const network = selectedNetwork.get();
    // Supersede any older request before handling local invalid/static states;
    // otherwise that older response could overwrite the newer user intent.
    const generation = ++searchGeneration;
    const queryType = classifyExplorerQuery(query);
    if (!queryType) {
      isSearching.set(false);
      searchResult.set({
        type: "invalid",
        found: false,
        network,
        query,
      });
      return;
    }
    // Standalone/static previews do not mount the platform's `/api/explorer`
    // route. Never turn the primary action into a silent no-op: keep the
    // scanner honest and give the user an inline, recoverable service state.
    if (!shouldUseExplorerApi()) {
      isSearching.set(false);
      searchResult.set({ type: "unavailable", found: false, network, query });
      return;
    }

    isSearching.set(true);
    searchResult.set(null);

    try {
      const res = await fetchWithTimeout(`${API_BASE}/search?q=${encodeURIComponent(query)}&network=${network}`);
      if (generation !== searchGeneration || selectedNetwork.get() !== network) return;
      if (res.ok) {
        try {
          searchResult.set(normalizeExplorerSearchResult(await res.json(), query, network));
        } catch (error) {
          console.warn("[useExplorer] search response failed:", error instanceof Error ? error.message : String(error));
          searchResult.set({ type: "unavailable", found: false, network, query });
        }
        return;
      }
      // A 404 is the API's "nothing matched this identifier" signal — surface a
      // calm not-found result rather than leaving the panel blank and silent.
      if (res.status === 404) {
        searchResult.set({
          type: queryType === "hash" ? "transaction" : queryType,
          found: false,
          network,
          query,
        });
        return;
      }
      searchResult.set({ type: "unavailable", found: false, network, query, status: res.status });
    } catch (error) {
      if (generation !== searchGeneration || selectedNetwork.get() !== network) return;
      console.warn("[useExplorer] search failed:", error instanceof Error ? error.message : String(error));
      searchResult.set({ type: "unavailable", found: false, network, query });
    } finally {
      if (generation === searchGeneration) isSearching.set(false);
    }
  };

  const viewTx = (hash: string) => {
    searchQuery.set(hash);
    void search();
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
    statsStatus,
    recentStatus,
    statsUpdatedAt,

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
