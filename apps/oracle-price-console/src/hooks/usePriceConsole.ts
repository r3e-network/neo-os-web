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

export function usePriceConsole({ app, t }: UsePriceConsoleOptions) {
  const network = getNetwork();
  // Kept for the display tiles only (contract hash / network labels); the
  // actual reads go through app.oracle.dataFeed.
  const integration = EXTERNAL_INTEGRATIONS[network];

  const asset = createObservable("NEO");
  const latestPrice = createObservable<number | null>(null);
  // dataTimestamp (epoch seconds) of the last successful read; 0 = none yet.
  const lastTimestamp = createObservable(0);
  const isRequesting = createObservable(false);
  const errorMsg = createObservable<string | null>(null);
  // Available feed pairs (base symbols). Seeded with instant defaults and
  // lazily extended from the on-chain catalog (listPairs) on first load.
  const availablePairs = createObservable<string[]>(["NEO", "GAS", "BTC"]);

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
      return price == null || price <= 0 ? t("notAvailable") : `$${price.toFixed(4)}`;
    },
    set: () => {},
    subscribe: (fn) => latestPrice.subscribe(fn),
  };

  function freshnessOf(): Freshness {
    if (!hasValidPrice()) return "idle";
    const ts = lastTimestamp.get();
    if (ts <= 0) return "fresh"; // feed omitted timestamp — cannot prove stale
    const age = Math.floor(Date.now() / 1000) - ts;
    return age > STALE_THRESHOLD_SECONDS ? "stale" : "fresh";
  }

  const freshness: Observable<Freshness> = {
    get: freshnessOf,
    set: () => {},
    subscribe: (fn) => lastTimestamp.subscribe(fn),
  };

  const freshnessLabel: Observable<string> = {
    get: () => {
      if (!hasValidPrice()) return t("priceStatusReady");
      const ts = lastTimestamp.get();
      if (ts <= 0) return t("priceStatusLive");
      const age = Math.max(0, Math.floor(Date.now() / 1000) - ts);
      const relative = formatRelativeAge(age, t);
      return age > STALE_THRESHOLD_SECONDS
        ? t("priceStatusStale", { age: relative })
        : t("priceStatusFresh", { age: relative });
    },
    set: () => {},
    subscribe: (fn) => lastTimestamp.subscribe(fn),
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

  const datafeedHash: Observable<string> = {
    get: () => integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedShort: Observable<string> = {
    get: () => `${integration.contracts.morpheusDatafeed.slice(0, 10)}...`,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  const sourceLabel: Observable<string> = {
    get: () => t("sourceOnChain", { network }),
    set: () => {},
    subscribe: () => () => {},
  };

  async function fetchPrice() {
    isRequesting.set(true);
    errorMsg.set(null);
    try {
      const quote = await app.oracle.dataFeed.price(asset.get(), { meta: true });
      latestPrice.set(quote.price);
      // Prefer the upstream data timestamp; fall back to the on-chain write
      // timestamp when the feed omits field [1].
      lastTimestamp.set(quote.dataTimestamp || quote.recordTimestamp || 0);
      return { success: true };
    } catch (e) {
      const raw = e instanceof Error ? e.message : "fetch failed";
      // Keep the raw fault text in the dev console; show users a stable message.
      console.error("[oracle-price-console] feed read failed:", raw);
      const localized = t(classifyFeedError(raw));
      errorMsg.set(localized);
      return { success: false, error: localized };
    } finally {
      isRequesting.set(false);
    }
  }

  async function loadPairs() {
    try {
      const pairs = await app.oracle.dataFeed.listPairs();
      const symbols = pairs
        .map((pair) => pair.replace(/^TWELVEDATA:/i, "").split("-")[0]?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol));
      if (symbols.length > 0) {
        // De-dupe while keeping the instant defaults first for stable ordering.
        const ordered = ["NEO", "GAS", "BTC", ...symbols];
        availablePairs.set([...new Set(ordered)]);
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

  return {
    asset,
    latestPrice,
    lastTimestamp,
    priceDisplay,
    freshness,
    freshnessLabel,
    freshnessTimestamp,
    datafeedHash,
    datafeedShort,
    networkDisplay,
    sourceLabel,
    availablePairs,
    isRequesting,
    errorMsg,
    fetchPrice,
    loadPairs,
    loadAll,
  };
}
