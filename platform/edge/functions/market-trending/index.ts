import { handleCorsPreflight } from "../_shared/cors.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseClient } from "../_shared/supabase.ts";

/**
 * Market Trending API Endpoint
 *
 * Calculates MiniApp transaction volume growth rate using a 7-day rolling window.
 * Returns ranked results of trending MiniApps based on growth rate.
 *
 * Algorithm: growth_rate = (today_tx - avg_7day_tx) / NULLIF(avg_7day_tx, 0)
 */

type PeriodType = "1d" | "7d" | "30d";

interface TrendingApp {
  app_id: string;
  name: string;
  icon: string;
  growth_rate: number;
  total_transactions: number;
  daily_transactions: number;
  rank: number;
}

interface TrendingResponse {
  trending: TrendingApp[];
  updated_at: string;
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(url: URL): { limit: number; period: PeriodType } {
  const limitParam = url.searchParams.get("limit");
  const periodParam = url.searchParams.get("period") as PeriodType | null;

  // Validate limit (1-50, default 20)
  let limit = 20;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      limit = parsed;
    }
  }

  // Validate period (1d/7d/30d, default 7d)
  let period: PeriodType = "7d";
  if (periodParam && ["1d", "7d", "30d"].includes(periodParam)) {
    period = periodParam;
  }

  return { limit, period };
}

/**
 * Convert period string to number of days
 */
function periodToDays(period: PeriodType): number {
  switch (period) {
    case "1d":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
  }
}

/**
 * Calculate growth rate for MiniApps based on daily transaction data
 * @param req - The incoming request
 * @param supabaseFactory - Optional supabase client factory for testing
 */
export async function handler(req: Request, supabaseFactory?: () => any): Promise<Response> {
  // Handle CORS preflight
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  // Only accept GET requests
  if (req.method !== "GET") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const rateLimited = await requireRateLimit(req, "market-trending");
  if (rateLimited) return rateLimited;

  // Parse and validate query parameters
  const url = new URL(req.url);
  const { limit, period } = parseQueryParams(url);
  const days = periodToDays(period);

  const supabase = supabaseFactory ? supabaseFactory() : supabaseClient();

  try {
    // Step 1: Get today's transaction counts per app
    const { data: todayData, error: todayErr } = await supabase
      .from("miniapp_stats_daily")
      .select("app_id, tx_count")
      .eq("date", new Date().toISOString().split("T")[0])
      .order("tx_count", { ascending: false });

    if (todayErr) {
      return error(500, `Failed to fetch today's stats: ${todayErr.message}`, "DB_ERROR", req);
    }

    // If no data for today, return empty results
    if (!todayData || todayData.length === 0) {
      return json(
        {
          trending: [],
          updated_at: new Date().toISOString(),
        } as TrendingResponse,
        {},
        req,
      );
    }

    // Step 2: Calculate average for the past N days for each app
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const todayDateStr = new Date().toISOString().split("T")[0];

    const { data: historicalData, error: historicalErr } = await supabase
      .from("miniapp_stats_daily")
      .select("app_id, tx_count")
      .gte("date", startDateStr)
      .lt("date", todayDateStr);

    if (historicalErr) {
      return error(500, `Failed to fetch historical stats: ${historicalErr.message}`, "DB_ERROR", req);
    }

    // Calculate average per app
    const avgMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};

    if (historicalData) {
      for (const row of historicalData) {
        const appId = row.app_id;
        const txCount = row.tx_count || 0;

        if (!avgMap[appId]) {
          avgMap[appId] = 0;
          countMap[appId] = 0;
        }

        avgMap[appId] += txCount;
        countMap[appId]++;
      }

      // Calculate final averages
      for (const appId in avgMap) {
        avgMap[appId] = avgMap[appId] / Math.max(countMap[appId], 1);
      }
    }

    // Step 3: Calculate growth rate for each app
    const growthData: Array<{ app_id: string; growth_rate: number; daily_transactions: number }> = [];

    for (const todayRow of todayData) {
      const appId = todayRow.app_id;
      const todayTx = todayRow.tx_count || 0;
      const avgTx = avgMap[appId] || 0;

      // Calculate growth rate: (today - avg) / avg
      // If avg is 0, treat growth as 0 (avoid division by zero)
      let growthRate = 0;
      if (avgTx > 0) {
        growthRate = (todayTx - avgTx) / avgTx;
      } else if (todayTx > 0) {
        // New app with transactions today but no history - infinite growth, cap at 10.0
        growthRate = 10.0;
      }

      growthData.push({
        app_id: appId,
        growth_rate: growthRate,
        daily_transactions: todayTx,
      });
    }

    // Step 4: Sort by growth rate descending
    growthData.sort((a, b) => b.growth_rate - a.growth_rate);

    // Step 5: Fetch app metadata and total stats for top apps
    const topAppIds = growthData.slice(0, limit).map((d) => d.app_id);

    if (topAppIds.length === 0) {
      return json(
        {
          trending: [],
          updated_at: new Date().toISOString(),
        } as TrendingResponse,
        {},
        req,
      );
    }

    // Fetch app details (name, icon)
    const { data: appsData, error: appsErr } = await supabase
      .from("miniapps")
      .select("app_id, name, icon, status")
      .in("app_id", topAppIds);

    if (appsErr) {
      console.warn("market-trending: failed to fetch app metadata", appsErr.message ?? appsErr);
    }

    // Fetch total stats
    const { data: statsData, error: statsErr } = await supabase
      .from("miniapp_stats")
      .select("app_id, total_transactions")
      .in("app_id", topAppIds);

    if (statsErr) {
      return error(500, `Failed to fetch app stats: ${statsErr.message}`, "DB_ERROR", req);
    }

    // Build lookup maps
    const appMetaMap: Record<string, { name: string; icon: string }> = {};
    const appStatusMap: Record<string, string> = {};
    if (appsData && !appsErr) {
      for (const app of appsData) {
        const name = String(app.name ?? app.app_id ?? "").trim();
        const icon = String(app.icon ?? "").trim();
        appMetaMap[app.app_id] = {
          name: name || app.app_id,
          icon,
        };
        const status = String(app.status ?? "").trim().toLowerCase();
        if (status) {
          appStatusMap[app.app_id] = status;
        }
      }
    }

    const statsMap: Record<string, number> = {};
    if (statsData) {
      for (const stat of statsData) {
        statsMap[stat.app_id] = stat.total_transactions || 0;
      }
    }

    // Step 6: Build final response
    const trending: TrendingApp[] = [];
    let rank = 1;

    const filteredGrowth = growthData.filter((entry) => {
      const status = appStatusMap[entry.app_id];
      if (!status) return true;
      return status === "active";
    });

    for (const growth of filteredGrowth.slice(0, limit)) {
      const meta = appMetaMap[growth.app_id] || { name: growth.app_id, icon: "" };
      const totalTx = statsMap[growth.app_id] || 0;

      trending.push({
        app_id: growth.app_id,
        name: meta.name,
        icon: meta.icon,
        growth_rate: Math.round(growth.growth_rate * 10000) / 10000, // Round to 4 decimals
        total_transactions: totalTx,
        daily_transactions: growth.daily_transactions,
        rank: rank++,
      });
    }

    return json(
      {
        trending,
        updated_at: new Date().toISOString(),
      } as TrendingResponse,
      {},
      req,
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return error(500, `Internal server error: ${errMsg}`, "INTERNAL_ERROR", req);
  }
}

Deno.serve((req: Request) => handler(req));
