import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import type { MiniAppInfo } from "@/components/types";
import { fetchCommunityApps } from "@/lib/community-apps";

export interface SearchResult {
  app_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  entry_url: string;
  supportedChains?: string[];
  source?: string;
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
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { q, category, limit = "20" } = req.query;
  const query = (typeof q === "string" ? q : "").toLowerCase().trim();
  const maxResults = Math.min(parseInt(limit as string) || 20, 100);

  if (!query) {
    return res.status(200).json({ results: [], total: 0, query: "", suggestions: getPopularSearches() });
  }

  const communityApps = await fetchCommunityApps({ status: "active", category: category as string | undefined });
  const results = searchApps(query, category as string, maxResults, [...BUILTIN_APPS, ...communityApps]);
  const suggestions = generateSuggestions(query);

  return res.status(200).json({
    results,
    total: results.length,
    query,
    suggestions,
  });
}

/** Full-text search across apps */
function searchApps(query: string, category: string | undefined, limit: number, apps: MiniAppInfo[]): SearchResult[] {
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
      if (app.name_zh && app.name_zh.toLowerCase().includes(term)) {
        score += 8;
        highlights.push({ field: "name_zh", snippet: highlightTerm(app.name_zh, term) });
      }
      // Description match
      if (app.description.toLowerCase().includes(term)) {
        score += 5;
        highlights.push({ field: "description", snippet: highlightTerm(app.description, term) });
      }
      if (app.description_zh && app.description_zh.toLowerCase().includes(term)) {
        score += 4;
        highlights.push({ field: "description_zh", snippet: highlightTerm(app.description_zh, term) });
      }
      // Category match
      if (app.category.toLowerCase().includes(term)) {
        score += 3;
      }
    }

    if (score === 0) return null;

    const entryUrl = app.entry_url || `/miniapps/${app.app_id}/index.html`;

    return {
      app_id: app.app_id,
      name: app.name,
      description: app.description,
      category: app.category as string,
      icon: app.icon,
      entry_url: entryUrl,
      supportedChains: app.supportedChains || [],
      source: app.source ?? "builtin",
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
function generateSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const q = query.toLowerCase();

  for (const app of BUILTIN_APPS) {
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
