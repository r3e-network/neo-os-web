import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { q, category, limit = "20" } = req.query;
  const query = (typeof q === "string" ? q : "").toLowerCase().trim();
  const maxResults = Math.min(parseInt(limit as string) || 20, 100);

  if (!query) {
    return res.status(200).json({ results: [], total: 0, query: "", suggestions: getPopularSearches() });
  }

  const results = searchApps(query, category as string, maxResults);
  const suggestions = generateSuggestions(query);

  return res.status(200).json({
    results,
    total: results.length,
    query,
    suggestions,
  });
}

/** Full-text search across apps */
function searchApps(query: string, category: string | undefined, limit: number): SearchResult[] {
  const terms = query.split(/\s+/).filter(Boolean);

  const scored = BUILTIN_APPS.map((app) => {
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
