/**
 * usePriceConsole — React hook for the on-chain Morpheus DataFeed price console.
 *
 * Reads prices DIRECTLY from the deployed MorpheusDataFeed contract via
 * Neo N3 JSON-RPC — through the framework's `app.oracle.dataFeed` reader
 * (main.tsx injects the network-specific contract + RPC endpoint via the
 * defineMiniApp `oracle` option). No off-chain HTTP, no Phala dependency,
 * no edge proxy.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "@shared/constants/rpc";

export interface UsePriceConsoleOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * A read older than this is labeled "stale" so a frozen feed (which keeps
 * returning HALT with its last value) is never presented as fresh — the exact
 * failure mode that hid the 3-month testnet feed freeze.
 */
export const STALE_THRESHOLD_SECONDS = 60 * 60; // 1 hour
export const MAX_FUTURE_SKEW_SECONDS = 2 * 60;
export const PRICE_SCALE_DECIMALS = 6;
export const MAX_CATALOG_PAIRS = 256;
const PRICE_SCALE = 10 ** PRICE_SCALE_DECIMALS;
const MAX_DATE_EPOCH_SECONDS = 8_640_000_000_000;

type FeedRoute = "aggregate" | "provider";

interface ExactPriceQuote {
  price: number;
  dataTimestamp: number;
  recordTimestamp: number;
}

/** Freshness classification for the displayed price's badge. */
export type Freshness = "idle" | "fresh" | "stale";

/**
 * Render an epoch-second timestamp as a localized "x ago" relative string.
 * Exported for direct unit testing of the freshness boundary logic.
 */
export function formatRelativeAge(
  ageSeconds: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (ageSeconds < 60) return t("ageJustNow");
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return t("ageMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("ageHours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("ageDays", { count: days });
}

/**
 * Map a raw RPC/feed error to a stable user-facing i18n key. The raw text is
 * kept for console.error only — end users never see "getLatest FAULT: ...".
 */
export function classifyFeedError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("not deployed")) return "errorFeedNotDeployed";
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("abort")) {
    return "errorFeedTimeout";
  }
  if (lower.includes("fault")) return "errorFeedFault";
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request")) {
    return "errorFeedNetwork";
  }
  return "errorFeedGeneric";
}

/**
 * Extract the base symbol from a real on-chain USD pair. The catalog contains
 * both canonical keys (`AGG:NEO-USD`) and provider keys
 * (`TWELVEDATA:NEO-USD`); treating everything before the first dash as a symbol
 * used to leak values such as `AGG:NEO` into the selector.
 */
export function catalogSymbol(pair: unknown): string | null {
  const value = typeof pair === "string" ? pair.trim().toUpperCase() : "";
  const match = /^(?:[A-Z0-9_]{1,24}:)?([A-Z0-9]{1,12})-USD$/.exec(value);
  return match?.[1] ?? null;
}

export function feedKeys(asset: unknown) {
  const symbol = typeof asset === "string" ? asset.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
    throw new Error("asset is required");
  }
  const pair = `${symbol}-USD`;
  return {
    aggregate: `AGG:${pair}`,
    provider: `TWELVEDATA:${pair}`,
  } as const;
}

/**
 * Normalize a launch-context value to the base symbol used by the selector.
 * Deep links may carry either a bare asset, a USD pair, or the exact resolved
 * feed key shown by this app. Non-USD quote pairs are rejected instead of
 * being silently relabeled as USD.
 */
export function launchAssetSymbol(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase();
  const withoutProvider = raw.replace(/^[A-Z0-9_]{1,24}:/, "");
  const match = /^([A-Z0-9]{1,12})(?:[-/]USD)?$/.exec(withoutProvider);
  return match?.[1] ?? "";
}

/** Keep the framework's six-decimal integer semantics exact at the app edge. */
export function exactPriceQuote(value: unknown): ExactPriceQuote | null {
  if (!value || typeof value !== "object") return null;
  const quote = value as Record<string, unknown>;
  if (typeof quote.price !== "number" || !Number.isFinite(quote.price) || quote.price <= 0) {
    return null;
  }
  const scaled = quote.price * PRICE_SCALE;
  const rounded = Math.round(scaled);
  if (
    !Number.isSafeInteger(rounded)
    || Math.abs(scaled - rounded) > 0.000_001
  ) {
    return null;
  }
  const timestamp = (field: unknown) => (
    typeof field === "number"
    && Number.isSafeInteger(field)
    && field > 0
    && field <= MAX_DATE_EPOCH_SECONDS
      ? field
      : 0
  );
  return {
    price: rounded / PRICE_SCALE,
    dataTimestamp: timestamp(quote.dataTimestamp),
    recordTimestamp: timestamp(quote.recordTimestamp),
  };
}

export function usePriceConsole({ app, t }: UsePriceConsoleOptions) {
  const network = getNetwork();
  // Kept for the display tiles only (contract hash / network labels); the
  // actual reads go through app.oracle.dataFeed.
  const integration = EXTERNAL_INTEGRATIONS[network];

  const asset = createObservable("NEO");
  const latestPrice = createObservable<number | null>(null);
  // On-chain write timestamp of the last successful read; 0 = unverified.
  const lastTimestamp = createObservable(0);
  // Upstream market-source time is disclosed separately. A fresh contract
  // write must not hide an old or missing source observation.
  const sourceTimestamp = createObservable(0);
  const feedRoute = createObservable<FeedRoute | "">("");
  const feedKey = createObservable("");
  const isRequesting = createObservable(false);
  const errorMsg = createObservable<string | null>(null);
  // Available feed pairs (base symbols). Seeded with instant defaults and
  // lazily extended from the on-chain catalog (listPairs) on first load.
  const availablePairs = createObservable<string[]>(["NEO", "GAS", "BTC"]);
  const freshnessTick = createObservable(0);
  let requestGeneration = 0;
  let catalogGeneration = 0;
  let freshnessTimer: ReturnType<typeof setTimeout> | null = null;

  function clearFreshnessTimer() {
    if (freshnessTimer) {
      clearTimeout(freshnessTimer);
      freshnessTimer = null;
    }
  }

  function clearDisplayedQuote() {
    clearFreshnessTimer();
    latestPrice.set(null);
    lastTimestamp.set(0);
    sourceTimestamp.set(0);
    feedRoute.set("");
    feedKey.set("");
  }

  function scheduleFreshnessBoundary(...timestamps: number[]) {
    clearFreshnessTimer();
    const nowMs = Date.now();
    const futureBoundaries = timestamps
      .filter((timestamp) => timestamp > 0 && timestamp * 1000 <= nowMs + MAX_FUTURE_SKEW_SECONDS * 1000)
      .map((timestamp) => (timestamp + STALE_THRESHOLD_SECONDS) * 1000 - nowMs)
      .filter((delayMs) => delayMs > 0);
    if (futureBoundaries.length === 0) return;
    const delayMs = Math.min(...futureBoundaries);
    freshnessTimer = setTimeout(() => {
      freshnessTimer = null;
      freshnessTick.set(freshnessTick.get() + 1);
      scheduleFreshnessBoundary(...timestamps);
    }, Math.min(delayMs + 25, 2_147_483_647));
  }

  // A feed read of 0 (or negative) is NOT a valid price — a frozen, uninitialized,
  // or unpriced pair returns 0 on a HALT, which must never be presented as a live
  // "$0.0000" with a green "Fresh" badge. Treat <= 0 the same as "no price yet"
  // everywhere freshness/display is derived, so the honest "Awaiting read" empty
  // state shows instead of a misleading zero.
  function hasValidPrice(): boolean {
    const price = latestPrice.get();
    return price != null && price > 0;
  }

  const priceDisplay: Observable<string> = {
    get: () => {
      const price = latestPrice.get();
      return price == null || price <= 0
        ? t("notAvailable")
        : `$${price.toFixed(PRICE_SCALE_DECIMALS)}`;
    },
    set: () => {},
    subscribe: (fn) => latestPrice.subscribe(fn),
  };

  function freshnessForTimestamp(timestamp: number): Freshness {
    if (!hasValidPrice()) return "idle";
    if (timestamp <= 0) return "stale";
    const age = Math.floor(Date.now() / 1000) - timestamp;
    if (age < -MAX_FUTURE_SKEW_SECONDS) return "stale";
    return age >= STALE_THRESHOLD_SECONDS ? "stale" : "fresh";
  }

  function freshnessOf(): Freshness {
    return freshnessForTimestamp(lastTimestamp.get());
  }

  const freshness: Observable<Freshness> = {
    get: freshnessOf,
    set: () => {},
    subscribe: (fn) => {
      const timestampSubscription = lastTimestamp.subscribe(fn);
      const tickSubscription = freshnessTick.subscribe(fn);
      return () => { timestampSubscription(); tickSubscription(); };
    },
  };

  const freshnessLabel: Observable<string> = {
    get: () => {
      if (!hasValidPrice()) return t("priceStatusReady");
      const ts = lastTimestamp.get();
      if (ts <= 0) return t("priceStatusUnverified");
      const rawAge = Math.floor(Date.now() / 1000) - ts;
      if (rawAge < -MAX_FUTURE_SKEW_SECONDS) return t("priceStatusTimestampInvalid");
      const age = Math.max(0, rawAge);
      const relative = formatRelativeAge(age, t);
      return age >= STALE_THRESHOLD_SECONDS
        ? t("priceStatusStale", { age: relative })
        : t("priceStatusFresh", { age: relative });
    },
    set: () => {},
    subscribe: (fn) => {
      const timestampSubscription = lastTimestamp.subscribe(fn);
      const tickSubscription = freshnessTick.subscribe(fn);
      return () => { timestampSubscription(); tickSubscription(); };
    },
  };

  // Absolute on-chain write time (local-formatted) of the displayed price. This
  // is the precise datum a user needs to independently verify freshness against
  // the chain — the relative "x ago" label alone cannot be cross-checked. Empty
  // when the feed omitted a timestamp or no valid read has happened yet.
  const freshnessTimestamp: Observable<string> = {
    get: () => {
      if (!hasValidPrice()) return "";
      const ts = lastTimestamp.get();
      if (ts <= 0) return "";
      return new Date(ts * 1000).toLocaleString();
    },
    set: () => {},
    subscribe: (fn) => lastTimestamp.subscribe(fn),
  };

  const sourceFreshness: Observable<Freshness> = {
    get: () => freshnessForTimestamp(sourceTimestamp.get()),
    set: () => {},
    subscribe: (fn) => {
      const timestampSubscription = sourceTimestamp.subscribe(fn);
      const tickSubscription = freshnessTick.subscribe(fn);
      return () => { timestampSubscription(); tickSubscription(); };
    },
  };

  const sourceFreshnessLabel: Observable<string> = {
    get: () => {
      if (!hasValidPrice()) return t("sourceTimestampPending");
      const timestamp = sourceTimestamp.get();
      if (timestamp <= 0) return t("sourceTimestampUnverified");
      const rawAge = Math.floor(Date.now() / 1000) - timestamp;
      if (rawAge < -MAX_FUTURE_SKEW_SECONDS) return t("sourceTimestampInvalid");
      const age = Math.max(0, rawAge);
      const relative = formatRelativeAge(age, t);
      return age >= STALE_THRESHOLD_SECONDS
        ? t("sourceTimestampStale", { age: relative })
        : t("sourceTimestampFresh", { age: relative });
    },
    set: () => {},
    subscribe: (fn) => {
      const timestampSubscription = sourceTimestamp.subscribe(fn);
      const tickSubscription = freshnessTick.subscribe(fn);
      return () => { timestampSubscription(); tickSubscription(); };
    },
  };

  const sourceTimestampDisplay: Observable<string> = {
    get: () => {
      if (!hasValidPrice() || sourceTimestamp.get() <= 0) return "";
      return new Date(sourceTimestamp.get() * 1000).toLocaleString();
    },
    set: () => {},
    subscribe: (fn) => sourceTimestamp.subscribe(fn),
  };

  const datafeedHash: Observable<string> = {
    get: () => integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedShort: Observable<string> = {
    get: () => {
      const hash = integration.contracts.morpheusDatafeed;
      return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "";
    },
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  const sourceLabel: Observable<string> = {
    get: () => {
      const route = feedRoute.get();
      const routeLabel = route === "aggregate"
        ? t("feedRouteAggregate")
        : route === "provider"
          ? t("feedRouteProvider")
          : t("feedRoutePending");
      return t("sourceResolved", { route: routeLabel, network });
    },
    set: () => {},
    subscribe: (fn) => feedRoute.subscribe(fn),
  };

  const rpcEndpoint: Observable<string> = {
    get: () => integration.rpcUrl,
    set: () => {},
    subscribe: () => () => {},
  };

  function hasPlausibleRecordTimestamp(quote: ExactPriceQuote) {
    if (quote.recordTimestamp <= 0) return false;
    return quote.recordTimestamp <= Math.floor(Date.now() / 1000) + MAX_FUTURE_SKEW_SECONDS;
  }

  function aggregateCanFallback(error: unknown) {
    const text = error instanceof Error ? error.message.toLowerCase() : "";
    return text.includes("fault")
      || text.includes("no record")
      || text.includes("price field")
      || text.includes("price overflow");
  }

  async function readBoundQuote(requestedAsset: string, isCurrent: () => boolean): Promise<{
    quote: ExactPriceQuote;
    route: FeedRoute;
    key: string;
  }> {
    const keys = feedKeys(requestedAsset);
    let aggregateCandidate: ExactPriceQuote | null = null;
    let aggregateError: unknown = null;

    try {
      const raw = await app.oracle.dataFeed.price(keys.aggregate, { meta: true });
      if (!isCurrent()) throw new Error("price read superseded");
      aggregateCandidate = exactPriceQuote(raw);
      if (aggregateCandidate && hasPlausibleRecordTimestamp(aggregateCandidate)) {
        return { quote: aggregateCandidate, route: "aggregate", key: keys.aggregate };
      }
    } catch (error) {
      if (!isCurrent()) throw error;
      aggregateError = error;
      if (!aggregateCanFallback(error)) throw error;
    }

    try {
      const raw = await app.oracle.dataFeed.price(keys.provider, { meta: true });
      if (!isCurrent()) throw new Error("price read superseded");
      const providerQuote = exactPriceQuote(raw);
      if (providerQuote && hasPlausibleRecordTimestamp(providerQuote)) {
        return { quote: providerQuote, route: "provider", key: keys.provider };
      }
      if (aggregateCandidate) {
        return { quote: aggregateCandidate, route: "aggregate", key: keys.aggregate };
      }
      if (providerQuote) {
        return { quote: providerQuote, route: "provider", key: keys.provider };
      }
    } catch (error) {
      if (aggregateCandidate) {
        return { quote: aggregateCandidate, route: "aggregate", key: keys.aggregate };
      }
      throw error;
    }

    if (aggregateError) throw aggregateError;
    throw new Error("getLatest FAULT: no usable price for pair");
  }

  function selectAsset(value: unknown) {
    const next = String(value ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,12}$/.test(next) || next === asset.get()) return false;
    requestGeneration += 1;
    asset.set(next);
    clearDisplayedQuote();
    errorMsg.set(null);
    isRequesting.set(false);
    return true;
  }

  async function fetchPrice() {
    const requestId = ++requestGeneration;
    const requestedAsset = asset.get();
    isRequesting.set(true);
    errorMsg.set(null);
    try {
      const resolved = await readBoundQuote(
        requestedAsset,
        () => requestId === requestGeneration && asset.get() === requestedAsset,
      );
      if (requestId !== requestGeneration || asset.get() !== requestedAsset) {
        return { success: false, ignored: true };
      }
      const { quote } = resolved;
      latestPrice.set(quote.price);
      const recordTime = quote.recordTimestamp;
      const marketTime = quote.dataTimestamp;
      lastTimestamp.set(recordTime);
      sourceTimestamp.set(marketTime);
      feedRoute.set(resolved.route);
      feedKey.set(resolved.key);
      scheduleFreshnessBoundary(recordTime, marketTime);
      return { success: true };
    } catch (e) {
      if (requestId !== requestGeneration || asset.get() !== requestedAsset) {
        return { success: false, ignored: true };
      }
      const raw = e instanceof Error ? e.message : "fetch failed";
      // Keep the raw fault text in the dev console; show users a stable message.
      console.error("[oracle-price-console] feed read failed:", raw);
      const localized = t(classifyFeedError(raw));
      clearDisplayedQuote();
      errorMsg.set(localized);
      return { success: false, error: localized };
    } finally {
      if (requestId === requestGeneration && asset.get() === requestedAsset) {
        isRequesting.set(false);
      }
    }
  }

  async function loadPairs() {
    const generation = ++catalogGeneration;
    try {
      const pairs = await app.oracle.dataFeed.listPairs();
      const symbols = pairs
        .slice(0, MAX_CATALOG_PAIRS)
        .map(catalogSymbol)
        .filter((symbol): symbol is string => Boolean(symbol));
      if (generation !== catalogGeneration) return;
      if (symbols.length > 0) {
        // De-dupe while keeping the instant defaults first for stable ordering.
        const ordered = ["NEO", "GAS", "BTC", ...symbols];
        availablePairs.set([...new Set(ordered)].slice(0, MAX_CATALOG_PAIRS));
      }
    } catch (e) {
      // The catalog is a progressive enhancement — a failure leaves the static
      // trio in place rather than blocking the console.
      console.error(
        "[oracle-price-console] pair catalog read failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // First paint reads the current asset (the read is free + ~300ms) and lazily
  // extends the pair catalog; both errors are silent on initial load.
  const loadAll = async () => {
    await Promise.allSettled([fetchPrice(), loadPairs()]);
  };

  const cleanup = () => {
    requestGeneration += 1;
    catalogGeneration += 1;
    clearFreshnessTimer();
    isRequesting.set(false);
  };

  return {
    asset,
    latestPrice,
    lastTimestamp,
    sourceTimestamp,
    feedRoute,
    feedKey,
    priceDisplay,
    freshness,
    freshnessLabel,
    freshnessTimestamp,
    sourceFreshness,
    sourceFreshnessLabel,
    sourceTimestampDisplay,
    datafeedHash,
    datafeedShort,
    networkDisplay,
    sourceLabel,
    rpcEndpoint,
    availablePairs,
    isRequesting,
    errorMsg,
    selectAsset,
    fetchPrice,
    loadPairs,
    loadAll,
    cleanup,
  };
}
