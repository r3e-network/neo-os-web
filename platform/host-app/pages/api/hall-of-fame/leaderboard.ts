/**
 * API: Hall of Fame Leaderboard
 * GET /api/hall-of-fame/leaderboard
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

type HallOfFameCategory = "people" | "community" | "developer";

interface HallOfFameEntry {
  id: string;
  name: string;
  category: HallOfFameCategory;
  score: number;
}

const FALLBACK_ENTRIES: HallOfFameEntry[] = [
  { id: "p1", name: "Da Hongfei", category: "people", score: 54020 },
  { id: "p2", name: "Erik Zhang", category: "people", score: 48900 },
  { id: "p3", name: "John DeVadoss", category: "people", score: 32150 },
  { id: "c1", name: "Neo News Today", category: "community", score: 89000 },
  { id: "c2", name: "N Zone", category: "community", score: 67500 },
  { id: "d1", name: "AxLabs", category: "developer", score: 92100 },
  { id: "d2", name: "COZ", category: "developer", score: 88500 },
  { id: "d3", name: "Red4Sec", category: "developer", score: 76000 },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedEntries: HallOfFameEntry[] = [];
let cacheTimestamp = 0;

function normalizeCategory(value: string | undefined): HallOfFameCategory | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "people" || normalized === "community" || normalized === "developer") {
    return normalized;
  }
  return null;
}

async function loadEntries(): Promise<HallOfFameEntry[]> {
  const now = Date.now();
  if (cachedEntries.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedEntries;
  }

  if (!isSupabaseConfigured) {
    cachedEntries = FALLBACK_ENTRIES;
    cacheTimestamp = now;
    return cachedEntries;
  }

  try {
    const { data, error } = await supabase
      .from("hall_of_fame_entries")
      .select("id, name, category, score")
      .order("score", { ascending: false });

    if (error || !data || data.length === 0) {
      cachedEntries = FALLBACK_ENTRIES;
    } else {
      cachedEntries = data.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        category: (row.category as HallOfFameCategory) || "people",
        score: Number(row.score) || 0,
      }));
    }
  } catch (err) {
    cachedEntries = FALLBACK_ENTRIES;
  }

  cacheTimestamp = now;
  return cachedEntries;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const category = normalizeCategory(req.query.category as string | undefined);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 100));

  const entries = await loadEntries();
  const filtered = category ? entries.filter((entry) => entry.category === category) : entries;

  return res.status(200).json({
    entrants: filtered.slice(0, limit),
    total: filtered.length,
  });
}
