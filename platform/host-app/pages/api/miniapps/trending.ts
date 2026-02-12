import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import type { MiniAppInfo } from "@/components/types";
import { fetchCommunityApps } from "@/lib/community-apps";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface TrendingApp {
  app_id: string;
  name: string;
  icon: string;
  category: string;
  entry_url: string;
  supportedChains?: string[];
  source?: string;
  score: number;
  stats: {
    users_24h: number;
    txs_24h: number;
    volume_24h: string;
    growth: number;
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { limit = "10", category } = req.query;
  const maxResults = Math.min(parseInt(limit as string) || 10, 50);

  try {
    const trending = await calculateTrending(category as string, maxResults);
    return res.status(200).json({ trending, updated_at: new Date().toISOString() });
  } catch (err) {
    logger.error("Trending API error", err);
    return res.status(500).json({ error: "Failed to fetch trending apps" });
  }
}

/** Calculate trending score based on Supabase stats */
async function calculateTrending(category: string | undefined, limit: number): Promise<TrendingApp[]> {
  const builtinApps = category ? BUILTIN_APPS.filter((a) => a.category === category) : BUILTIN_APPS;
  const communityApps = await fetchCommunityApps({ status: "active", category });
  const apps = mergeApps(builtinApps, communityApps);

  // Fetch stats from Supabase if configured
  const statsMap = await fetchStatsFromSupabase(apps.map((a) => a.app_id));

  return apps
    .map((app) => {
      const stats = statsMap.get(app.app_id) || getDefaultStats();
      const score = calculateScore(stats);
      const entryUrl = app.entry_url || `/miniapps/${app.app_id}/index.html`;

      return {
        app_id: app.app_id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        entry_url: entryUrl,
        supportedChains: app.supportedChains || [],
        source: app.source ?? "builtin",
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

function mergeApps(builtinApps: MiniAppInfo[], communityApps: MiniAppInfo[]): MiniAppInfo[] {
  const byId = new Map<string, MiniAppInfo>();
  for (const app of builtinApps) {
    byId.set(app.app_id, app);
  }
  for (const app of communityApps) {
    if (!byId.has(app.app_id)) byId.set(app.app_id, app);
  }
  return Array.from(byId.values());
}

/** Fetch stats from Supabase miniapp_stats table */
async function fetchStatsFromSupabase(
  appIds: string[],
): Promise<Map<string, { users: number; txs: number; volume: number; growth: number }>> {
  const statsMap = new Map<string, { users: number; txs: number; volume: number; growth: number }>();

  if (!appIds.length) {
    return statsMap;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return statsMap;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from("miniapp_stats")
      .select("app_id, active_users_daily, transactions_24h, volume_24h_gas")
      .in("app_id", appIds);

    if (error) {
      logger.error("Supabase stats fetch error", error);
      return statsMap;
    }

    for (const row of data || []) {
      statsMap.set(row.app_id, {
        users: row.active_users_daily || 0,
        txs: row.transactions_24h || 0,
        volume: parseFloat(row.volume_24h_gas || "0"),
        growth: 0, // Calculate from historical data if available
      });
    }
  } catch (err) {
    logger.error("Failed to fetch stats from Supabase", err);
  }

  return statsMap;
}

/** Default stats when no data available */
function getDefaultStats(): { users: number; txs: number; volume: number; growth: number } {
  return { users: 0, txs: 0, volume: 0, growth: 0 };
}

/** Calculate trending score using weighted formula */
function calculateScore(stats: { users: number; txs: number; volume: number; growth: number }): number {
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
