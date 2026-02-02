/**
 * Price data utilities for fetching and caching token prices
 */

export interface PriceData {
    neo: number;
    neoBurger: number;
    neoBurgerToNeo: number;
    updatedAt: number;
}

// Simple in-memory cache with 5 minute TTL
let priceCache: PriceData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches NEO and neoBurger prices
 * Uses mock data for now - can be integrated with real price API later
 */
export async function getPrices(): Promise<PriceData> {
    const now = Date.now();

    // Return cached data if still valid
    if (priceCache && (now - cacheTimestamp) < CACHE_TTL) {
        return priceCache;
    }

    // Mock price data - in production, fetch from an API
    // You can integrate with CoinGecko, Flamingo, etc.
    const mockPrices: PriceData = {
        neo: 15.50,
        neoBurger: 17.80,
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
