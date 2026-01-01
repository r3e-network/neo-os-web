/**
 * Dynamic App Highlights API
 * Fetches real-time highlight data for MiniApp cards
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";
import { getNeoBurgerStats } from "@/lib/neoburger";

// Cache for API responses (60 second TTL)
const cache = new Map<string, { data: HighlightData[]; timestamp: number }>();
const CACHE_TTL = 60 * 1000;

// Stats cache
let statsCache: { data: Map<string, AppStats>; timestamp: number } | null = null;
const STATS_CACHE_TTL = 120 * 1000;

interface AppStats {
  total_users: number;
  total_transactions: number;
  total_gas_used: string;
}

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
    const highlights = await fetchHighlights(appId, req.headers.host || "localhost:3000");

    // Update cache
    cache.set(appId, { data: highlights, timestamp: Date.now() });

    res.status(200).json({ highlights });
  } catch (error) {
    console.error(`Failed to fetch highlights for ${appId}:`, error);
    res.status(200).json({ highlights: [] });
  }
}

async function fetchHighlights(appId: string, host: string): Promise<HighlightData[]> {
  // Special handlers for specific apps
  switch (appId) {
    case "miniapp-neoburger":
      return fetchNeoBurgerHighlights();
    case "miniapp-priceticker":
      return fetchPriceHighlights();
  }

  // For all other apps, fetch real stats from database
  const stats = await fetchAppStats(appId, host);
  if (!stats) return [];

  return generateHighlightsFromStats(appId, stats);
}

async function fetchNeoBurgerHighlights(): Promise<HighlightData[]> {
  const stats = await getNeoBurgerStats("mainnet");
  return [
    { label: "APR", value: `${stats.apr}%`, icon: "📈", trend: "up" },
    { label: "Staked", value: `${stats.totalStaked} NEO`, icon: "🍔" },
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

// Fetch real stats from miniapp-stats API
async function fetchAppStats(appId: string, host: string): Promise<AppStats | null> {
  // Check stats cache
  if (statsCache && Date.now() - statsCache.timestamp < STATS_CACHE_TTL) {
    return statsCache.data.get(appId) || null;
  }

  try {
    const protocol = host.includes("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${host}/api/miniapp-stats`);
    const data = await res.json();

    const statsMap = new Map<string, AppStats>();
    for (const stat of data.stats || []) {
      statsMap.set(stat.app_id, {
        total_users: stat.total_users || 0,
        total_transactions: stat.total_transactions || 0,
        total_gas_used: stat.total_gas_used || "0",
      });
    }

    statsCache = { data: statsMap, timestamp: Date.now() };
    return statsMap.get(appId) || null;
  } catch {
    return null;
  }
}

// Generate highlights based on app category and real stats
function generateHighlightsFromStats(appId: string, stats: AppStats): HighlightData[] {
  const users = formatNumber(stats.total_users);
  const txs = formatNumber(stats.total_transactions);
  const volume = stats.total_gas_used;

  // Category-specific highlight templates
  if (appId.includes("lottery") || appId.includes("coinflip") || appId.includes("dice")) {
    return [
      { label: "Players", value: users, icon: "👥" },
      { label: "Games", value: txs, icon: "🎮" },
    ];
  }

  if (appId.includes("swap") || appId.includes("flash") || appId.includes("defi")) {
    return [
      { label: "Volume", value: `${volume} GAS`, icon: "💰" },
      { label: "Txs", value: txs, icon: "📊" },
    ];
  }

  if (appId.includes("vote") || appId.includes("gov")) {
    return [
      { label: "Voters", value: users, icon: "🗳️" },
      { label: "Votes", value: txs, icon: "✅" },
    ];
  }

  // Default highlights
  return [
    { label: "Users", value: users, icon: "👥" },
    { label: "Txs", value: txs, icon: "📊" },
  ];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}
