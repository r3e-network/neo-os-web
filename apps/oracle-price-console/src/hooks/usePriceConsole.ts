/**
 * usePriceConsole — React hook for the on-chain Morpheus DataFeed price console.
 *
 * Reads prices DIRECTLY from the deployed MorpheusDataFeed contract via
 * Neo N3 JSON-RPC — through the framework's `app.oracle.dataFeed` reader
 * (main.tsx injects the network-specific contract + RPC endpoint via the
 * defineMiniApp `oracle` option). No off-chain HTTP, no Phala dependency,
 * no edge proxy.
 */

import { createDerived, createObservable, createReadCell } from "@shared/react/context";
import type { Observable, ReadCell } from "@shared/react/context";
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

/**
 * One settled feed read: the exact quote plus the route/key that produced it.
 * This is the read-cell's unit of truth. An explicit `null` is the
 * settled-empty verdict — a completed read with nothing displayable (a failed
 * re-read clears the console to it) — distinct from the cell's `undefined`,
 * which means "not read yet" and keeps the view shimmering.
 */
interface FeedReading {
  price: number;
  /** On-chain write timestamp of the read; 0 = unverified. */
  recordTimestamp: number;
  /** Upstream market-source observation time; 0 = unverified. */
  sourceTimestamp: number;
  route: FeedRoute;
  key: string;
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

/**
 * Render a quantized feed price as a headline figure.
 *
 * PRICE_SCALE_DECIMALS is the CONTRACT scale — the on-chain integer carries six
 * decimal places — not a display decision. Printing it verbatim made the
 * flagship LATEST PRICE stat read "$1.967000": the storage format, machine-
 * dumped onto the hero. The zeros the scale pads on carry no information.
 *
 * This trims that padding without ever dropping a digit the feed actually
 * published: `exactPriceQuote` has already quantized `price` to exactly six
 * decimals, and a six-decimal maximum reproduces it exactly, so a genuine
 * $1.984001 still prints in full while $1.967000 becomes $1.967. The
 * two-decimal minimum keeps round figures reading as money ($1.04, not $1.04
 * collapsing to $1), and grouping keeps four-figure pairs legible.
 */
export function formatPriceForDisplay(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: PRICE_SCALE_DECIMALS,
  }).format(price);
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

  /**
   * The ONE feed reading, on the platform read-cell (read-cell pilot). The
   * cell's `value === undefined` IS the old hand-rolled `priceSettled ===
   * false` unread state, and a failed read publishes an explicit `null`
   * settled-empty verdict, so "has a read answered yet?" lives in the value
   * itself instead of a parallel boolean.
   *
   * The pair is a per-call read parameter: the loader captures it (and this
   * request's generation) when the load STARTS, so a pair switch mid-flight
   * can never relabel the departing pair's quote — the same guard the
   * hand-rolled `fetchPrice` carried.
   */
  const quoteCell: ReadCell<FeedReading | null> = createReadCell(
    async (): Promise<FeedReading> => {
      const requestId = requestGeneration;
      const requestedAsset = asset.get();
      const isCurrent = () =>
        requestId === requestGeneration && asset.get() === requestedAsset;
      const resolved = await readBoundQuote(requestedAsset, isCurrent);
      // A stale-but-resolved read must not publish: the cell's epoch already
      // blocks a publish raced by a newer load()/reset(), and this covers the
      // remaining supersession source (cleanup mid-flight).
      if (!isCurrent()) throw new Error("price read superseded");
      return {
        price: resolved.quote.price,
        recordTimestamp: resolved.quote.recordTimestamp,
        sourceTimestamp: resolved.quote.dataTimestamp,
        route: resolved.route,
        key: resolved.key,
      };
    },
  );

  const latestPrice = createDerived<number | null>(
    () => quoteCell.value.get()?.price ?? null,
    [quoteCell.value],
  );
  // On-chain write timestamp of the last successful read; 0 = unverified.
  const lastTimestamp = createDerived(
    () => quoteCell.value.get()?.recordTimestamp ?? 0,
    [quoteCell.value],
  );
  // Upstream market-source time is disclosed separately. A fresh contract
  // write must not hide an old or missing source observation.
  const sourceTimestamp = createDerived(
    () => quoteCell.value.get()?.sourceTimestamp ?? 0,
    [quoteCell.value],
  );
  const feedRoute = createDerived<FeedRoute | "">(
    () => quoteCell.value.get()?.route ?? "",
    [quoteCell.value],
  );
  const feedKey = createDerived(
    () => quoteCell.value.get()?.key ?? "",
    [quoteCell.value],
  );
  /**
   * True once a feed read has completed, success or failure. `latestPrice ==
   * null` alone cannot tell "the feed read is still in flight" from "the feed
   * read came back with nothing" — both leave it null, so both rendered the
   * same "N/A". The pair price is a public contract read that fires for every
   * visitor on arrival, so that ambiguity is the console's first impression.
   * `isRequesting` cannot stand in for this: it is still false on the very
   * first frame, before lifecycle mount has called `loadAll`.
   *
   * Derived from the cell's value: a real quote and the explicit `null`
   * settled-empty verdict both count as "a read has answered"; only the
   * unread `undefined` keeps the shimmer. Deliberately NOT the cell's status
   * — a re-read of the same pair flips status back to "loading", but the
   * console keeps showing the previous verdict until the re-read answers.
   */
  const priceSettled = createDerived(
    () => quoteCell.value.get() !== undefined,
    [quoteCell.value],
  );

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

  // The ONE price reading, for the PlayArea and the shell chrome alike. It used
  // to have a display-only twin (`priceStatDisplay`) invented before the shell
  // could express "not read yet"; that twin is gone. The manifest binds this
  // observable directly and declares `pendingKey`, so the three phases are
  // distinguished HERE, in one place, rather than duplicated:
  //
  //   · unread          → `undefined`. The shell renders the binding's
  //                       pendingKey copy, and the PlayArea shimmers (it gates
  //                       on `priceSettled`). `undefined` is the shell's only
  //                       trigger, and `""`/`null` are values it would print.
  //   · settled + quote → the formatted price.
  //   · settled, empty  → a real "unavailable" reading. The read is DONE and
  //                       the feed had no usable quote — a different answer from
  //                       "still reading", so it must NOT borrow the pending
  //                       copy, and must never be a fabricated $0.
  const priceDisplay: Observable<string | undefined> = {
    get: () => {
      if (!priceSettled.get()) return undefined;
      return hasValidPrice() ? formatPriceForDisplay(latestPrice.get()!) : t("priceUnavailable");
    },
    set: () => {},
    subscribe: (fn) => {
      // Reads BOTH the value and the read's phase, so it must wake on either —
      // a settle with no price moves `priceSettled` while `latestPrice` stays
      // null, and the chrome would otherwise never leave the pending copy.
      const priceSubscription = latestPrice.subscribe(fn);
      const settledSubscription = priceSettled.subscribe(fn);
      return () => { priceSubscription(); settledSubscription(); };
    },
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
      // "Ready for a fresh read" is a claim about a settled, idle console. While
      // the first read is still in flight it is simply untrue — and it used to
      // sit beside an "N/A" price and a spinning "Reading…" button, so the page
      // contradicted itself on arrival. Say nothing until we know; the view
      // renders the in-flight state as a shimmer.
      if (!priceSettled.get() || isRequesting.get()) return "";
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
      // The label now reads the read's phase as well as its result, so it must
      // wake when the phase moves or the shimmer would outlive the read.
      const settledSubscription = priceSettled.subscribe(fn);
      const requestingSubscription = isRequesting.subscribe(fn);
      return () => { timestampSubscription(); tickSubscription(); settledSubscription(); requestingSubscription(); };
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
    // `network` is getNetwork()'s internal routing enum ("mainnet"/"testnet"),
    // not a name to show a visitor. Emitting it verbatim badged the header chip
    // bare lowercase "mainnet". Resolve it to the localized label instead.
    get: () => (network === "testnet" ? t("networkTestnet") : t("networkMainnet")),
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
    clearFreshnessTimer();
    // The new pair has not been read yet — back to shimmering, not to a stale
    // verdict inherited from the pair the visitor just left. reset() returns
    // the cell to unread (`undefined`, so `priceSettled` reads false) and
    // invalidates any in-flight load's publish.
    quoteCell.reset();
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
      // The cell publishes the quote itself (epoch-guarded, so a superseded
      // read can never land); on success the derived quote observables and
      // `priceSettled` follow from the published value.
      const reading = await quoteCell.load();
      if (requestId !== requestGeneration || asset.get() !== requestedAsset) {
        return { success: false, ignored: true };
      }
      if (reading) {
        // The freshness boundary timer is app-side domain logic; it stays here.
        scheduleFreshnessBoundary(reading.recordTimestamp, reading.sourceTimestamp);
      }
      return { success: true };
    } catch (e) {
      if (requestId !== requestGeneration || asset.get() !== requestedAsset) {
        return { success: false, ignored: true };
      }
      const raw = e instanceof Error ? e.message : "fetch failed";
      // Keep the raw fault text in the dev console; show users a stable message.
      console.error("[oracle-price-console] feed read failed:", raw);
      const localized = t(classifyFeedError(raw));
      // A failed read CLEARS the displayed quote. The cell keeps its last good
      // value on a throw (stale-but-real stays renderable), but this console's
      // honesty contract is stricter: a stale quote must not survive a failed
      // re-read, and must not be replaced by a fabricated zero either. Publish
      // the explicit `null` settled-empty verdict — one read round has
      // completed, so "no price" now means "unavailable", not "still asking".
      clearFreshnessTimer();
      quoteCell.value.set(null);
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
    // Invalidate any in-flight load's publish (reset joins the cell's epoch)
    // while handing back the reading unmount found — cleanup has never blanked
    // the console, it only stops it moving.
    const reading = quoteCell.value.get();
    const readingStatus = quoteCell.status.get();
    quoteCell.reset();
    quoteCell.value.set(reading);
    quoteCell.status.set(readingStatus);
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
    priceSettled,
    errorMsg,
    selectAsset,
    fetchPrice,
    loadPairs,
    loadAll,
    cleanup,
  };
}
