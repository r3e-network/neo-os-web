import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";

export interface TrendingApp {
  app_id: string;
  name: string;
  icon: string;
  category: string;
  score: number;
  stats: {
    users_24h: number;
    txs_24h: number;
    volume_24h: string;
    growth: number; // percentage
  };
}

// In-memory stats cache (replace with Supabase in production)
const statsCache: Map<string, { users: number; txs: number; volume: number; ts: number }> = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { limit = "10", category } = req.query;
  const maxResults = Math.min(parseInt(limit as string) || 10, 50);

  const trending = calculateTrending(category as string, maxResults);

  return res.status(200).json({ trending, updated_at: new Date().toISOString() });
}

/** Calculate trending score based on activity metrics */
function calculateTrending(category: string | undefined, limit: number): TrendingApp[] {
  const apps = category ? BUILTIN_APPS.filter((a) => a.category === category) : BUILTIN_APPS;

  return apps
    .map((app) => {
      const stats = getAppStats(app.app_id);
      const score = calculateScore(stats);

      return {
        app_id: app.app_id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        score,
        stats: {
          users_24h: stats.users,
          txs_24h: stats.txs,
          volume_24h: formatVolume(stats.volume),
          growth: stats.growth,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Get app stats from cache or generate mock data */
function getAppStats(appId: string): { users: number; txs: number; volume: number; growth: number } {
  const cached = statsCache.get(appId);
  const now = Date.now();

  // Return cached if fresh (< 5 min)
  if (cached && now - cached.ts < 300000) {
    return { ...cached, growth: Math.floor(Math.random() * 50) - 10 };
  }

  // Generate mock stats (replace with real data in production)
  const stats = {
    users: Math.floor(Math.random() * 500) + 50,
    txs: Math.floor(Math.random() * 2000) + 100,
    volume: Math.floor(Math.random() * 10000) + 500,
    ts: now,
  };
  statsCache.set(appId, stats);

  return { ...stats, growth: Math.floor(Math.random() * 50) - 10 };
}

/** Calculate trending score using weighted formula */
function calculateScore(stats: { users: number; txs: number; volume: number; growth: number }): number {
  // Weighted score: users (40%) + txs (30%) + volume (20%) + growth (10%)
  const normalizedUsers = Math.min(stats.users / 500, 1) * 40;
  const normalizedTxs = Math.min(stats.txs / 2000, 1) * 30;
  const normalizedVolume = Math.min(stats.volume / 10000, 1) * 20;
  const normalizedGrowth = Math.max(0, (stats.growth + 10) / 60) * 10;

  return Math.round(normalizedUsers + normalizedTxs + normalizedVolume + normalizedGrowth);
}

/** Format volume as string with K/M suffix */
function formatVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return volume.toString();
}
