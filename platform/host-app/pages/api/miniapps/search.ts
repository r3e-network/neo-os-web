import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { loadMiniAppCatalog } from "@/lib/miniapp-catalog";

export interface SearchResult {
  app_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  score: number;
  highlights?: { field: string; snippet: string }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  suggestions?: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SearchResponse | { error: string }>) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  if (standardLimit(req, res)) return;

  const { q, category, limit = "20" } = req.query;
  const query = (typeof q === "string" ? q : "").slice(0, 200).toLowerCase().trim();
  const maxResults = Math.max(1, Math.min(parseInt(limit as string) || 20, 100));

  if (!query) {
    return res.status(200).json({ results: [], total: 0, query: "", suggestions: getPopularSearches() });
  }

  try {
    const catalog = await loadMiniAppCatalog("active");
    const results = searchApps(catalog, query, category as string, maxResults);
    const suggestions = generateSuggestions(catalog, query);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      results,
      total: results.length,
      query,
      suggestions,
    });
  } catch (err) {
    logger.error("Failed to search miniapps:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res);
  }
}

/** Full-text search across apps */
function searchApps(
  apps: Array<{ app_id: string; name: string; description: string; category: string; icon: string }>,
  query: string,
  category: string | undefined,
  limit: number,
): SearchResult[] {
  const terms = query.split(/\s+/).filter(Boolean);

  const scored = apps.map((app) => {
    let score = 0;
    const highlights: { field: string; snippet: string }[] = [];

    // Category filter
    if (category && app.category !== category) return null;

    for (const term of terms) {
      // Name match (highest weight)
      if (app.name.toLowerCase().includes(term)) {
        score += 10;
        highlights.push({ field: "name", snippet: highlightTerm(app.name, term) });
      }
      // Description match
      if (app.description.toLowerCase().includes(term)) {
        score += 5;
        highlights.push({ field: "description", snippet: highlightTerm(app.description, term) });
      }
      // Category match
      if (app.category.toLowerCase().includes(term)) {
        score += 3;
      }
    }

    if (score === 0) return null;

    return {
      app_id: app.app_id,
      name: app.name,
      description: app.description,
      category: app.category as string,
      icon: app.icon,
      score,
      highlights,
    } as SearchResult;
  }).filter((r): r is SearchResult => r !== null);

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Highlight matching term in text */
function highlightTerm(text: string, term: string): string {
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return text.slice(0, 50);
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + term.length + 30);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}

/** Generate search suggestions based on query */
function generateSuggestions(
  apps: Array<{ name: string }>,
  query: string,
): string[] {
  const suggestions: string[] = [];
  const q = query.toLowerCase();

  for (const app of apps) {
    if (app.name.toLowerCase().startsWith(q) && suggestions.length < 5) {
      suggestions.push(app.name);
    }
  }

  return suggestions;
}

/** Get popular searches for empty query */
function getPopularSearches(): string[] {
  return ["lottery", "dice", "vote", "swap", "nft", "poker"];
}
