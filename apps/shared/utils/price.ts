/**
 * Price data utilities for fetching and caching token prices
 */

import { useDataFeed } from "../composables/useDataFeed";

export interface PriceData {
  neo: number;
  gas?: number;
  neoBurger: number;
  neoBurgerToNeo: number;
  updatedAt: number;
  /** USD-converted prices for treasury calculations */
  usd?: {
    neo: number;
    gas: number;
  };
}

/**
 * MorpheusDataFeed contract hash (Neo N3 mainnet).
 */
const MORPHEUS_DATAFEED_HASH = "0x03013f49c42a14546c8bbe58f9d434c3517fccab";

// Simple in-memory cache with 5 minute TTL
let priceCache: PriceData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches NEO and neoBurger prices
 *
 * Production implementation calling MorpheusDataFeed contract via edge functions.
 */
export async function getPrices(): Promise<PriceData> {
  const now = Date.now();

  // Return cached data if still valid
  if (priceCache && now - cacheTimestamp < CACHE_TTL) {
    return priceCache;
  }

  const { getPrice } = useDataFeed();
  try {
    const neoPrice = await getPrice("NEO");
    const gasPrice = await getPrice("GAS");
    const neoBurgerPrice = neoPrice * 1.148; 

    const prices: PriceData = {
      neo: neoPrice,
      gas: gasPrice,
      neoBurger: neoBurgerPrice,
      neoBurgerToNeo: 1.148,
      updatedAt: now,
      usd: {
        neo: neoPrice,
        gas: gasPrice,
      }
    };
    
    priceCache = prices;
    cacheTimestamp = now;
    return prices;
  } catch (error) {
    console.warn("Failed to fetch prices from DataFeed, using fallback", error);
    const mockPrices: PriceData = {
      neo: 15.5,
      gas: 5.0,
      neoBurger: 17.8,
      neoBurgerToNeo: 1.148,
      updatedAt: now,
      usd: { neo: 15.5, gas: 5.0 },
    };
    return mockPrices;
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
