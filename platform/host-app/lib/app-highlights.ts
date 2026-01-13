import type { HighlightData } from "@/components/features/miniapp/DynamicBanner";

/**
 * App Highlights Service
 * Fetches highlight data from Supabase database
 * No static/mock data - all data comes from database
 */

export type AppHighlightConfig = {
  appId: string;
  highlights: HighlightData[];
};

// In-memory cache for highlights (TTL: 60 seconds)
const highlightsCache = new Map<string, { data: HighlightData[]; timestamp: number }>();
const CACHE_TTL = 60 * 1000;

/**
 * Get highlight data for a specific app
 * Returns undefined if no highlights exist in database
 * Note: This is a sync function for backward compatibility
 * Use fetchAppHighlights for async database access
 */
export function getAppHighlights(appId: string): HighlightData[] | undefined {
  const cached = highlightsCache.get(appId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  // Return undefined - data should be fetched via API
  return undefined;
}

/**
 * Get highlight data for multiple apps (sync version)
 * Returns a map of appId -> highlights from cache only
 */
export function getAppsHighlights(appIds: string[]): Map<string, HighlightData[]> {
  const result = new Map<string, HighlightData[]>();
  for (const appId of appIds) {
    const cached = highlightsCache.get(appId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result.set(appId, cached.data);
    }
  }
  return result;
}

/**
 * Update cache with fetched highlights
 * Called by API routes after fetching from database
 */
export function updateHighlightsCache(appId: string, highlights: HighlightData[]): void {
  highlightsCache.set(appId, { data: highlights, timestamp: Date.now() });
}

/**
 * Update cache with batch highlights
 */
export function updateHighlightsCacheBatch(highlights: Record<string, HighlightData[]>): void {
  const now = Date.now();
  for (const [appId, data] of Object.entries(highlights)) {
    highlightsCache.set(appId, { data, timestamp: now });
  }
}

/**
 * Generate default highlights based on app stats
 * Used as fallback when no specific highlights are configured
 */
export function generateDefaultHighlights(stats?: {
  users?: number;
  transactions?: number;
  volume?: string;
}): HighlightData[] | undefined {
  if (!stats) return undefined;

  const highlights: HighlightData[] = [];

  if (stats.users && stats.users > 0) {
    highlights.push({
      label: "Users",
      value: formatCompact(stats.users),
      icon: "👥",
    });
  }

  if (stats.transactions && stats.transactions > 0) {
    highlights.push({
      label: "Txs",
      value: formatCompact(stats.transactions),
      icon: "📊",
    });
  }

  if (stats.volume && stats.volume !== "0 GAS") {
    highlights.push({
      label: "Vol",
      value: stats.volume,
      icon: "💰",
    });
  }

  return highlights.length > 0 ? highlights : undefined;
}

function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
