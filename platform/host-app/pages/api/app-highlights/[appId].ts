/**
 * Dynamic App Highlights API
 * Fetches real-time highlight data for MiniApp cards
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";
import { getNeoBurgerStats } from "@/lib/neoburger";
import { getAppHighlights } from "@/lib/app-highlights";

// Cache for API responses (60 second TTL)
const cache = new Map<string, { data: HighlightData[]; timestamp: number }>();
const CACHE_TTL = 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ highlights: HighlightData[] } | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "appId is required" });
  }

  try {
    // Check cache
    const cached = cache.get(appId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({ highlights: cached.data });
    }

    // Fetch real data based on app type
    const highlights = await fetchHighlights(appId);

    // Update cache
    cache.set(appId, { data: highlights, timestamp: Date.now() });

    res.status(200).json({ highlights });
  } catch (error) {
    console.error(`Failed to fetch highlights for ${appId}:`, error);

    // Fallback to static data
    const fallback = getAppHighlights(appId) || [];
    res.status(200).json({ highlights: fallback });
  }
}

async function fetchHighlights(appId: string): Promise<HighlightData[]> {
  switch (appId) {
    case "miniapp-neoburger":
      return fetchNeoBurgerHighlights();
    case "miniapp-priceticker":
      return fetchPriceHighlights();
    default:
      return getAppHighlights(appId) || [];
  }
}

async function fetchNeoBurgerHighlights(): Promise<HighlightData[]> {
  const stats = await getNeoBurgerStats("mainnet");
  return [
    { label: "APR", value: `${stats.apr}%`, icon: "📈", trend: "up" },
    { label: "Staked", value: `${stats.totalStakedFormatted} NEO`, icon: "🍔" },
  ];
}

async function fetchPriceHighlights(): Promise<HighlightData[]> {
  // Fetch from price API or oracle
  const prices = await fetchTokenPrices();
  return [
    { label: "NEO", value: `$${prices.neo}`, icon: "📊", trend: prices.neoTrend },
    { label: "GAS", value: `$${prices.gas}`, icon: "⛽", trend: prices.gasTrend },
  ];
}

async function fetchTokenPrices(): Promise<{
  neo: string;
  gas: string;
  neoTrend: "up" | "down" | "neutral";
  gasTrend: "up" | "down" | "neutral";
}> {
  try {
    const response = await fetch("https://api.flamingo.finance/token-info/prices");
    const data = await response.json();

    return {
      neo: (data.NEO || 12.5).toFixed(2),
      gas: (data.GAS || 4.8).toFixed(2),
      neoTrend: "neutral",
      gasTrend: "neutral",
    };
  } catch {
    return { neo: "12.50", gas: "4.80", neoTrend: "neutral", gasTrend: "neutral" };
  }
}
