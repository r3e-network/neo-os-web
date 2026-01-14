/**
 * API: Hall of Fame Leaderboard
 * GET /api/hall-of-fame/leaderboard
 *
 * All data comes from Supabase - no mock/fallback data
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

type HallOfFameCategory = "people" | "community" | "developer";
type Period = "day" | "week" | "month" | "all";

interface HallOfFameEntry {
  id: string;
  name: string;
  category: HallOfFameCategory;
  score: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedEntries: HallOfFameEntry[] | null = null;
let cacheTimestamp = 0;

function normalizeCategory(value: string | undefined): HallOfFameCategory | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "people" || normalized === "community" || normalized === "developer") {
    return normalized;
  }
  return null;
}

function normalizePeriod(value: string | undefined): Period {
  if (!value) return "all";
  const normalized = value.trim().toLowerCase();
  if (normalized === "day" || normalized === "week" || normalized === "month") {
    return normalized;
  }
  return "all";
}

function getPeriodStart(period: Period): Date | null {
  if (period === "all") return null;
  const start = new Date();
  if (period === "day") {
    start.setDate(start.getDate() - 1);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "month") {
    start.setMonth(start.getMonth() - 1);
  }
  return start;
}

async function loadEntries(): Promise<HallOfFameEntry[]> {
  const now = Date.now();
  if (cachedEntries && cachedEntries.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedEntries;
  }

  if (!isSupabaseConfigured) {
    // Return empty array when database not configured - no mock data
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("hall_of_fame_entries")
      .select("id, name, category, score")
      .order("score", { ascending: false });

    if (error) {
      console.error("Failed to fetch hall of fame entries:", error);
      return cachedEntries || [];
    }

    if (!data || data.length === 0) {
      // No data in database - return empty, not mock data
      cachedEntries = [];
    } else {
      cachedEntries = data.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        category: (row.category as HallOfFameCategory) || "people",
        score: Number(row.score) || 0,
      }));
    }

    cacheTimestamp = now;
    return cachedEntries;
  } catch (err) {
    console.error("Hall of fame query error:", err);
    // Return cached data if available, otherwise empty array
    return cachedEntries || [];
  }
}

async function loadPeriodScores(period: Period): Promise<Record<string, number>> {
  const start = getPeriodStart(period);
  if (!start) return {};
  const { data, error } = await supabase
    .from("hall_of_fame_votes")
    .select("entrant_id, score_added, created_at")
    .gte("created_at", start.toISOString());

  if (error) {
    throw error;
  }

  const totals: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    const id = String(row.entrant_id);
    const added = Number(row.score_added) || 0;
    totals[id] = (totals[id] || 0) + added;
  });
  return totals;
}


export function invalidateCache() {
  cachedEntries = null;
  cacheTimestamp = 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const category = normalizeCategory(req.query.category as string | undefined);
  const period = normalizePeriod(req.query.period as string | undefined);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 100));

  let entries = await loadEntries();

  if (period !== "all") {
    try {
      const scores = await loadPeriodScores(period);
      entries = entries
        .map((entry) => ({
          ...entry,
          score: scores[entry.id] ?? 0,
        }))
        .filter((entry) => entry.score > 0);
    } catch (err) {
      console.error("Failed to compute period scores:", err);
      return res.status(500).json({ error: "Failed to load leaderboard" });
    }
  }

  const filtered = category ? entries.filter((entry) => entry.category === category) : entries;
  const sorted = filtered.slice().sort((a, b) => b.score - a.score);

  return res.status(200).json({
    entrants: sorted.slice(0, limit),
    total: sorted.length,
  });
}
