/**
 * MiniApp Highlights API
 * Fetches highlight data from Supabase database
 * No static/mock data - all data comes from database
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface HighlightData {
  label: string;
  value: string;
  icon?: string;
  trend?: "up" | "down";
}

interface HighlightsResponse {
  highlights: Record<string, HighlightData[]>;
  source: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HighlightsResponse | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  // Get app IDs from query (comma-separated) or fetch all
  const appIdsParam = req.query.app_ids as string | undefined;
  const appIds = appIdsParam ? appIdsParam.split(",") : undefined;

  try {
    // Query miniapp_highlights table
    let query = supabase
      .from("miniapp_highlights")
      .select("app_id, label, value, icon, trend, display_order")
      .order("display_order", { ascending: true });

    if (appIds && appIds.length > 0) {
      query = query.in("app_id", appIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Highlights query error:", error);
      return res.status(500).json({ error: "Failed to fetch highlights" });
    }

    // Group highlights by app_id
    const highlights: Record<string, HighlightData[]> = {};

    if (data) {
      for (const row of data) {
        if (!highlights[row.app_id]) {
          highlights[row.app_id] = [];
        }
        highlights[row.app_id].push({
          label: row.label,
          value: row.value,
          icon: row.icon || undefined,
          trend: row.trend || undefined,
        });
      }
    }

    res.status(200).json({ highlights, source: "database" });
  } catch (error) {
    console.error("Highlights API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
