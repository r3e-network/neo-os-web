/**
 * Price data utilities for fetching and caching token prices
 */

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
 * TODO: Use this contract to fetch real on-chain prices via invokeRead
 * instead of relying on the hardcoded fallback values below.
 */
const MORPHEUS_DATAFEED_HASH = "0x03013f49c42a14546c8bbe58f9d434c3517fccab";

// Simple in-memory cache with 5 minute TTL
let priceCache: PriceData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches NEO and neoBurger prices
 *
 * WARNING: Currently returns hardcoded fallback prices.
 * Production implementation should call MorpheusDataFeed contract
 * ({@link MORPHEUS_DATAFEED_HASH}) via invokeRead for real on-chain prices.
 */
export async function getPrices(): Promise<PriceData> {
  const now = Date.now();

  // Return cached data if still valid
  if (priceCache && now - cacheTimestamp < CACHE_TTL) {
    return priceCache;
  }

  // FALLBACK: Hardcoded mock prices. Replace with MorpheusDataFeed contract call
  // (MORPHEUS_DATAFEED_HASH) or off-chain oracle (CoinGecko, Flamingo, etc.).
  const mockPrices: PriceData = {
    neo: 15.5,
    neoBurger: 17.8,
    neoBurgerToNeo: 1.148, // neoBurger/NEO ratio
    updatedAt: now,
  };

  priceCache = mockPrices;
  cacheTimestamp = now;

  return mockPrices;
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
