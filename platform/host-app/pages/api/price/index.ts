import type { NextApiRequest, NextApiResponse } from "next";

// CoinGecko API - same as neo-treasury.pages.dev
const COINGECKO_API =
  "https://api.coingecko.com/api/v3/simple/price?ids=neo,gas&vs_currencies=usd&include_24hr_change=true";

// Cache for price data (5 minute TTL)
let priceCache: {
  data: PriceData | null;
  timestamp: number;
} = { data: null, timestamp: 0 };

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface PriceData {
  neo: { usd: number; usd_24h_change: number };
  gas: { usd: number; usd_24h_change: number };
  timestamp: number;
}

async function fetchPrices(): Promise<PriceData> {
  const now = Date.now();

  // Return cached data if still valid
  if (priceCache.data && now - priceCache.timestamp < CACHE_TTL) {
    return priceCache.data;
  }

  const res = await fetch(COINGECKO_API);
  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }

  const data = await res.json();
  const priceData: PriceData = {
    neo: {
      usd: data.neo?.usd ?? 0,
      usd_24h_change: data.neo?.usd_24h_change ?? 0,
    },
    gas: {
      usd: data.gas?.usd ?? 0,
      usd_24h_change: data.gas?.usd_24h_change ?? 0,
    },
    timestamp: now,
  };

  // Update cache
  priceCache = { data: priceData, timestamp: now };
  return priceData;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS headers for miniapps
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

  try {
    const prices = await fetchPrices();
    return res.status(200).json(prices);
  } catch (error) {
    console.error("[Price API] Error:", error);
    return res.status(500).json({ error: "Failed to fetch prices" });
  }
}
