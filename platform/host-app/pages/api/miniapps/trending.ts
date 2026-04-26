import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { loadMiniAppCatalog, loadMiniAppStatsMap } from "@/lib/miniapp-catalog";

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
    growth: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  if (standardLimit(req, res)) return;

  const { limit = "10", category } = req.query;
  const maxResults = Math.min(parseInt(limit as string, 10) || 10, 50);

  const [catalog, statsMap] = await Promise.all([
    loadMiniAppCatalog("active"),
    loadMiniAppStatsMap(),
  ]);

  const filtered = category
    ? catalog.filter((app) => app.category === String(category))
    : catalog;

  const scored: TrendingApp[] = filtered.map((app) => {
    const stats = statsMap[app.app_id] ?? {
      users: 0,
      transactions: 0,
      volume: 0,
      lastActivityAt: null,
    };
    const growth = estimateGrowth(stats.lastActivityAt);
    const score = calculateScore({
      users: stats.users,
      txs: stats.transactions,
      volume: stats.volume,
      growth,
    });

    return {
      app_id: app.app_id,
      name: app.name,
      icon: app.icon,
      category: app.category,
      score,
      stats: {
        users_24h: stats.users,
        txs_24h: stats.transactions,
        volume_24h: formatVolume(stats.volume),
        growth,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({
    trending: scored.slice(0, maxResults),
    updated_at: new Date().toISOString(),
  });
  return;
}

function estimateGrowth(lastActivityAt: string | null): number {
  if (!lastActivityAt) return 0;
  const last = new Date(lastActivityAt).getTime();
  if (Number.isNaN(last)) return 0;
  const now = Date.now();
  const ageHours = Math.max((now - last) / (1000 * 60 * 60), 0);
  if (ageHours <= 1) return 25;
  if (ageHours <= 6) return 15;
  if (ageHours <= 24) return 5;
  if (ageHours <= 72) return -5;
  return -10;
}

function calculateScore(stats: {
  users: number;
  txs: number;
  volume: number;
  growth: number;
}): number {
  const normalizedUsers = Math.min(stats.users / 500, 1) * 40;
  const normalizedTxs = Math.min(stats.txs / 2000, 1) * 30;
  const normalizedVolume = Math.min(stats.volume / 10000, 1) * 20;
  const normalizedGrowth = Math.max(0, (stats.growth + 10) / 60) * 10;
  return Math.round(
    normalizedUsers + normalizedTxs + normalizedVolume + normalizedGrowth,
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return volume.toFixed(2);
}
