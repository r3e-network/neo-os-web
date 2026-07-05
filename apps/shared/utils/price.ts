/**
 * Price data utilities for fetching and caching token prices.
 *
 * Reads directly from the on-chain MorpheusDataFeed contract — no
 * off-chain HTTP shortcut. Same source-of-truth that any on-chain
 * consumer would read.
 */

import { useMorpheusDataFeed } from "../composables/useMorpheusDataFeed";

export interface PriceData {
  neo: number;
  gas?: number;
  neoBurger?: number;
  neoBurgerToNeo?: number;
  /**
   * When this quote was assembled. Reflects the feed's own freshness: it is the
   * OLDER price leg's on-chain `recordTimestamp` (the time the feed last wrote
   * the value on-chain), in epoch ms — NOT the wall-clock fetch time. A frozen
   * feed keeps returning HALT with its last value, so binding `updatedAt` to the
   * on-chain record stops a stale price from looking "updated now".
   */
  updatedAt: number;
  /**
   * The older price leg's on-chain `recordTimestamp` in epoch ms, surfaced
   * separately so consumers can compute the feed's age without inferring it from
   * `updatedAt`. `0` when neither leg reported a record time.
   */
  feedRecordTimestamp: number;
  /** USD-converted prices for treasury calculations */
  usd?: {
    neo: number;
    gas: number;
  };
}

// Simple in-memory cache with 5 minute TTL
let priceCache: PriceData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * How old the on-chain feed record may be before its price is no longer treated
 * as live for treasury USD totals. The Morpheus feed keeps returning HALT with
 * its last value even when updates stopped (the on-chain feed has been observed
 * frozen for months), so an unbounded read would render a frozen price as a
 * fresh "live synced" USD total. One hour is generous for a treasury dashboard
 * (balances move slowly) while still rejecting a feed that has clearly stalled.
 */
export const PRICE_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches live NEO and GAS prices from the on-chain MorpheusDataFeed.
 *
 * Returns `null` when the feed's most recent on-chain record is older than
 * {@link PRICE_STALE_AFTER_MS}: a frozen feed must not be presented as a live
 * USD total. Consumers render their existing "price feed unavailable" / dash
 * placeholder in that case.
 */
export async function getPrices(): Promise<PriceData | null> {
  const now = Date.now();

  // Return cached data if still valid AND still within the freshness window.
  // The cache TTL bounds how often we hit the chain; the staleness window bounds
  // how old the underlying feed record may be — both must hold.
  if (
    priceCache &&
    now - cacheTimestamp < CACHE_TTL &&
    !isFeedRecordStale(priceCache.feedRecordTimestamp, now)
  ) {
    return priceCache;
  }

  const { getPriceWithMeta } = useMorpheusDataFeed();
  try {
    const neoQuote = await getPriceWithMeta("NEO");
    const gasQuote = await getPriceWithMeta("GAS");

    // Freshness is the OLDER leg's on-chain recordTimestamp (epoch seconds → ms):
    // a single stale leg makes the combined USD total stale. recordTimestamp is
    // when the feed last WROTE on-chain, so a frozen feed stops advancing it.
    const oldestRecordSec = Math.min(
      neoQuote.recordTimestamp || 0,
      gasQuote.recordTimestamp || 0,
    );
    const feedRecordTimestamp = oldestRecordSec > 0 ? oldestRecordSec * 1000 : 0;

    // A feed whose newest on-chain record predates the freshness window is NOT
    // live data. Refuse to present it as a USD total — return null so the
    // treasury renders its dash placeholder + "price feed unavailable" warning
    // instead of a fresh-looking but frozen number.
    if (isFeedRecordStale(feedRecordTimestamp, now)) {
      clearPriceCache();
      return null;
    }

    const prices: PriceData = {
      neo: neoQuote.price,
      gas: gasQuote.price,
      // updatedAt mirrors the on-chain record time (not wall-clock now), so a
      // delayed-but-acceptable feed reports its true age rather than "now".
      updatedAt: feedRecordTimestamp || now,
      feedRecordTimestamp,
      usd: {
        neo: neoQuote.price,
        gas: gasQuote.price,
      },
    };

    priceCache = prices;
    cacheTimestamp = now;
    return prices;
  } catch (error) {
    throw new Error(
      `Failed to fetch live prices from Morpheus DataFeed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * True when an on-chain feed record timestamp (epoch ms) is older than the
 * freshness window. A `0`/unknown record time is treated as stale: without a
 * usable record time we cannot prove the value is live, so we must not present
 * it as one.
 */
function isFeedRecordStale(feedRecordTimestamp: number, now: number): boolean {
  if (!feedRecordTimestamp || feedRecordTimestamp <= 0) return true;
  return now - feedRecordTimestamp > PRICE_STALE_AFTER_MS;
}

/**
 * Clears the price cache
 */
export function clearPriceCache(): void {
  priceCache = null;
  cacheTimestamp = 0;
}
