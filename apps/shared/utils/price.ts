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
  updatedAt: number;
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
 * Fetches live NEO and GAS prices.
 *
 * Production implementation calling MorpheusDataFeed contract via edge functions.
 */
export async function getPrices(): Promise<PriceData> {
  const now = Date.now();

  // Return cached data if still valid
  if (priceCache && now - cacheTimestamp < CACHE_TTL) {
    return priceCache;
  }

  const { getPrice } = useMorpheusDataFeed();
  try {
    const neoPrice = await getPrice("NEO");
    const gasPrice = await getPrice("GAS");

    const prices: PriceData = {
      neo: neoPrice,
      gas: gasPrice,
      updatedAt: now,
      usd: {
        neo: neoPrice,
        gas: gasPrice,
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
 * Clears the price cache
 */
export function clearPriceCache(): void {
  priceCache = null;
  cacheTimestamp = 0;
}

/**
 * Formats a price value with currency symbol
 */
export function formatPrice(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
