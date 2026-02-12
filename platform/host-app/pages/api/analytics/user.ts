import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface UserAnalytics {
  wallet: string;
  summary: {
    totalTx: number;
    totalVolume: string;
    appsUsed: number;
    firstActivity: string;
    lastActivity: string;
  };
  activity: ActivityItem[];
  appBreakdown: AppUsage[];
}

interface ActivityItem {
  date: string;
  txCount: number;
  volume: string;
}

interface AppUsage {
  appId: string;
  appName: string;
  txCount: number;
  volume: string;
  lastUsed: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet } = req.query;
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Wallet address required" });
  }

  try {
    const analytics = await fetchUserAnalytics(wallet);
    return res.status(200).json(analytics);
  } catch (err) {
    logger.error("User analytics error", err);
    return res.status(500).json({ error: "Failed to fetch user analytics" });
  }
}

/** Fetch user analytics from Supabase */
async function fetchUserAnalytics(wallet: string): Promise<UserAnalytics> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return getEmptyAnalytics(wallet);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch user summary from leaderboard
  const { data: userData } = await supabase.from("user_leaderboard").select("*").eq("wallet", wallet).single();

  // Fetch activity history (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: activityData } = await supabase
    .from("user_activity")
    .select("activity_date, tx_count, volume")
    .eq("wallet", wallet)
    .gte("activity_date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("activity_date", { ascending: true });

  // Fetch app breakdown
  const { data: appData } = await supabase
    .from("user_activity")
    .select("app_id, app_name, tx_count, volume, created_at")
    .eq("wallet", wallet)
    .order("created_at", { ascending: false });

  return buildAnalytics(wallet, userData, activityData, appData);
}

/** Return empty analytics when Supabase not configured */
function getEmptyAnalytics(wallet: string): UserAnalytics {
  return {
    wallet,
    summary: {
      totalTx: 0,
      totalVolume: "0",
      appsUsed: 0,
      firstActivity: "",
      lastActivity: "",
    },
    activity: [],
    appBreakdown: [],
  };
}

/** Build analytics from Supabase data */
function buildAnalytics(
  wallet: string,
  userData: Record<string, unknown> | null,
  activityData: Record<string, unknown>[] | null,
  appData: Record<string, unknown>[] | null,
): UserAnalytics {
  // Build activity timeline
  const activity: ActivityItem[] = (activityData || []).map((row) => ({
    date: String(row.activity_date),
    txCount: Number(row.tx_count) || 0,
    volume: String(row.volume || "0"),
  }));

  // Build app breakdown (deduplicate by app_id)
  const appMap = new Map<string, AppUsage>();
  for (const row of appData || []) {
    const appId = String(row.app_id);
    if (!appMap.has(appId)) {
      appMap.set(appId, {
        appId,
        appName: String(row.app_name || appId),
        txCount: Number(row.tx_count) || 0,
        volume: String(row.volume || "0"),
        lastUsed: String(row.created_at || ""),
      });
    }
  }

  return {
    wallet,
    summary: {
      totalTx: Number(userData?.total_tx) || 0,
      totalVolume: String(userData?.total_volume || "0"),
      appsUsed: Number(userData?.apps_used) || appMap.size,
      firstActivity: String(userData?.first_activity_at || ""),
      lastActivity: String(userData?.last_activity_at || ""),
    },
    activity,
    appBreakdown: Array.from(appMap.values()),
  };
}
